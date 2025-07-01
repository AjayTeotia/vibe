import prisma from "@/lib/db";
import { lastAssistantMessageContent } from "@/lib/utils";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, createNetwork, createState, createTool, gemini, type Message, type Tool } from "@inngest/agent-kit";
import { z } from "zod";
import { inngest } from "./client";
import { getSandbox } from "./utils";
import { SANDBOX_TIMEOUT } from "./types";

interface AgentState {
    summary: string;
    files: { [path: string]: string };
}

export const codeAgentFunction = inngest.createFunction(
    { id: "code-agent" },
    { event: "code-agent/run" },
    async ({ event, step }) => {
        const sandboxId = await step.run("get-sandbox", async () => {
            const sandbox = await Sandbox.create("vibe-nextjs-ajay-test");
            await sandbox.setTimeout(SANDBOX_TIMEOUT);
            return sandbox.sandboxId;
        });

        const previousMessage = await step.run("get-previous-message", async () => {
            const formattedMessage: Message[] = []

            const messages = await prisma.message.findMany({
                where: {
                    projectId: event.data.projectId
                },
                orderBy: {
                    createdAt: "desc"
                },
                take: 5
            })

            for (const message of messages) {
                if (!message.content) continue;

                formattedMessage.push({
                    type: "text",
                    role: message.role === "ASSISTANT" ? "assistant" : "user",
                    content: message.content
                })
            }

            return formattedMessage.reverse();
        })

        const state = createState<AgentState>(
            {
                summary: "",
                files: {}
            },
            {
                messages: previousMessage
            }
        )

        const codeAgent = createAgent<AgentState>({
            name: "code-agent",
            description: "An expert code agent",
            system: PROMPT,
            model: gemini({
                model: "gemini-2.0-flash"
            }),
            tools: [
                createTool({
                    name: "terminal",
                    description: "Use the terminal to run commands",
                    parameters: z.object({
                        command: z.string(),
                    }),
                    handler: async ({ command }, { step }) => {
                        return await step?.run("terminal", async () => {
                            const buffers = { stdout: "", stderr: "" };

                            try {
                                const sandbox = await getSandbox(sandboxId);
                                const result = await sandbox.commands.run(command, {
                                    onStdout: (data: string) => {
                                        buffers.stdout += data;
                                    },
                                    onStderr: (data: string) => {
                                        buffers.stderr += data;
                                    }
                                })

                                return result.stdout;
                            } catch (error) {
                                console.error(
                                    `Command failed: ${error} \n stdout: ${buffers.stdout} \n stderr: ${buffers.stderr}`
                                );
                            }
                        })
                    }
                }),
                createTool({
                    name: "createOrUpdateFile",
                    description: "Create or update a file in the sandbox",
                    parameters: z.object({
                        files: z.array(
                            z.object({
                                path: z.string(),
                                content: z.string(),
                            }),
                        )
                    }),
                    handler: async ({ files }, { step, network }: Tool.Options<AgentState>) => {
                        const newFiles = await step?.run("createOrUpdateFile", async () => {
                            try {
                                const updateFiles = network.state.data.files || {}
                                const sandbox = await getSandbox(sandboxId);
                                for (const file of files) {
                                    await sandbox.files.write(file.path, file.content);
                                    updateFiles[file.path] = file.content
                                }

                                return updateFiles
                            } catch (error) {
                                return "Error: " + error
                            }
                        })

                        if (typeof newFiles === "object") {
                            network.state.data.files = newFiles
                        }
                    }
                }),
                createTool({
                    name: "readFile",
                    description: "Read a file from the sandbox",
                    parameters: z.object({
                        files: z.array(z.string()),
                    }),
                    handler: async ({ files }, { step }) => {
                        return await step?.run("readFile", async () => {
                            try {
                                const sandbox = await getSandbox(sandboxId);
                                const contents = []
                                for (const file of files) {
                                    const fileContent = await sandbox.files.read(file)
                                    contents.push({ path: file, content: fileContent })
                                }

                                return JSON.stringify(contents)
                            } catch (error) {
                                return "Error: " + error
                            }
                        })
                    }
                })
            ],
            lifecycle: {
                onResponse: async ({ result, network }) => {
                    const lastAssistantTextMessageText = lastAssistantMessageContent(result);

                    if (lastAssistantTextMessageText && network) {
                        if (lastAssistantTextMessageText.includes("<task_summary>")) {
                            network.state.data.summary = lastAssistantTextMessageText
                        }
                    }

                    return result
                },
            }
        });

        const network = createNetwork<AgentState>({
            name: "codding-agent-network",
            agents: [codeAgent],
            maxIter: 15,
            defaultState: state,
            router: async ({ network }) => {
                const summary = network.state.data.summary

                if (summary) {
                    return;
                }

                return codeAgent;
            }
        })

        const result = await network.run(event.data.value, { state })


        const fragmentTitleGenerator = createAgent({
            name: "fragment-title-generator",
            description: "A fragment title generator",
            system: FRAGMENT_TITLE_PROMPT,
            model: gemini({
                model: "gemini-1.5-flash"
            }),
        });

        const responseGenerator = createAgent({
            name: "response-generator",
            description: "A response generator",
            system: RESPONSE_PROMPT,
            model: gemini({
                model: "gemini-1.5-flash"
            }),
        });

        const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(result.state.data.summary);
        const { output: responseOutput } = await responseGenerator.run(result.state.data.summary);

        const generateFragmentTitle = () => {
            const firstOutput = fragmentTitleOutput[0];

            if (firstOutput.type === "text") {
                return firstOutput.content || "Fragment";
            }

            if (firstOutput.type === "tool_result") {
                const content = firstOutput.content;
                if (Array.isArray(content)) {
                    return content[0]?.content || "Fragment";
                }
                return content || "Fragment";
            }

            return "Fragment";
        };

        const generateResponse = () => {
            const firstOutput = responseOutput[0];

            if (firstOutput.type === "text") {
                return firstOutput.content || "Here you go!";
            }

            if (firstOutput.type === "tool_result") {
                const content = firstOutput.content;
                if (Array.isArray(content)) {
                    return content[0]?.content || "Here you go!";
                }
                return content || "Here you go!";
            }

            return "Here you go!";
        };


        const isError =
            !result.state.data.summary ||
            Object.keys(result.state.data.files).length === 0

        const sandboxUrl = await step.run("get-sandbox-url", async () => {
            const sandbox = await getSandbox(sandboxId);
            const host = sandbox.getHost(3000);
            return `http://${host}`;
        });

        await step.run("save-result", async () => {
            if (isError) {
                console.error(result.state.data.summary)
                return await prisma.message.create({
                    data: {
                        projectId: event.data.projectId,
                        content: "Something went wrong. Please try again.",
                        role: "ASSISTANT",
                        type: "ERROR",
                    }
                })
            }

            return prisma.message.create({
                data: {
                    projectId: event.data.projectId,
                    content: generateResponse(),
                    role: "ASSISTANT",
                    type: "RESULT",
                    Fragment: {
                        create: {
                            sandboxUrl: sandboxUrl,
                            title: generateFragmentTitle(),
                            files: result.state.data.files
                        }
                    }
                }
            })
        })

        return {
            url: sandboxUrl,
            title: "Fragment",
            files: result.state.data.files,
            summary: result.state.data.summary
        };
    }
);
