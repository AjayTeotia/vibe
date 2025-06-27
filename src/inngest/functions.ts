import { inngest } from "./client";

import { gemini, createAgent } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
    { id: "hello-world" },
    { event: "test/hello.world" },
    async ({ event, step }) => {
        // Imagine this is a download step
        await step.sleep("wait-a-moment", "5s");
        const codeAgent = createAgent({
            name: "code-agent",
            system: "You are an expert next.js developer. You write readable, maintainable code. You write simple Next.js and react snippets",
            model: gemini({
                model: "gemini-1.5-flash",
            })
        });


        const { output } = await codeAgent.run(
            `Write the following snippet: ${event.data.value}`,
        );
        console.log(output);
        return { output };
    },
);
