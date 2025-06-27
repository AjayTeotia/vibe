import { Sandbox } from "@e2b/code-interpreter";
import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";
import { getSandbox } from "./utils";

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
            system: "You are an expert next.js developer. You write readable, maintainable code. You write simple Next.js and React snippets.",
            model: gemini({
                model: "gemini-1.5-flash",
            }),
        });

        // 🧾 Step 3: Run the agent with the input from the event
        const { output } = await codeAgent.run(
            `Write the following snippet: ${event.data.value}`
        );
        console.log(output);

        // 🌐 Step 4: Get sandbox URL on port 3000
        const sandboxUrl = await step.run("get-sandbox-url", async () => {
            const sandbox = await getSandbox(sandboxId);
            const host = sandbox.getHost(3000);
            return `http://${host}`;
        });

        return { output, sandboxUrl };
    }
);
