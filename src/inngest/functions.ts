import { Sandbox } from "@e2b/code-interpreter";
import { createAgent, createNetwork, createTool, gemini } from "@inngest/agent-kit";
import { z } from "zod";
import { inngest } from "./client";
import { getSandbox } from "./utils";
import { PROMPT } from "@/prompt";
import { lastAssistantMessageContent } from "@/lib/utils";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event, step }) => {
        // 🛠️ Step 1: Create a sandbox from your template
        const sandboxId = await step.run("get-sandbox", async () => {
            const sandbox = await Sandbox.create("vibe-nextjs-ajay-test"); // or use ID: "ppnq7s6sftgs3a69a33o"
            return sandbox.sandboxId;
        });

        // 🧠 Step 2: Setup the code agent
        const codeAgent = createAgent({
            name: "code-agent",
            description: "An expert code agent",
            system: PROMPT,
            model: gemini({ model: "gemini-2.0-flash" }),
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
                    handler: async ({ files }, { step, network }) => {
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

        const network = createNetwork({
            name: "codding-agent-network",
            agents: [codeAgent],
            maxIter: 15,
            router: async ({ network }) => {
                const summary = network.state.data.summary

                if (summary) {
                    return;
                }

                return codeAgent;
            }
        })

        const result = await network.run(event.data.value)

        // 🌐 Step 4: Get sandbox URL on port 3000
        const sandboxUrl = await step.run("get-sandbox-url", async () => {
            const sandbox = await getSandbox(sandboxId);
            const host = sandbox.getHost(3000);
            return `http://${host}`;
        });

        return {
            url: sandboxUrl,
            title: "Fragment",
            files: result.state.data.files,
            summary: result.state.data.summary
        };
    }
);
