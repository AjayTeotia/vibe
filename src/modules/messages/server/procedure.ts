import { inngest } from "@/inngest/client"
import prisma from "@/lib/db"
import { baseProcedure, createTRPCRouter } from "@/trpc/init"
import { z } from "zod"

export const messageRoute = createTRPCRouter({
    getMany: baseProcedure
        .input(
            z.object({
                projectId: z.string()
                    .min(1, { message: "Project is required" })
            })
        )
        .query(async ({ input }) => {
            const message = await prisma.message.findMany({
                where: {
                    projectId: input.projectId
                },
                orderBy: {
                    updatedAt: "asc",
                },
                include: {
                    Fragment: true
                }
            });

            return message;
        })
    ,

    create: baseProcedure
        .input(
            z.object({
                value: z.string()
                    .min(1, { message: "Message is required" })
                    .max(10000, { message: "Message is too long" }),
                projectId: z.string()
                    .min(1, { message: "Project is required" })
            })
        )
        .mutation(async ({ input }) => {
            const createMessage = await prisma.message.create({
                data: {
                    content: input.value,
                    projectId: input.projectId,
                    role: "USER",
                    type: "RESULT",
                }
            })

            await inngest.send({
                name: "code-agent/run",
                data: {
                    value: input.value,
                    projectId: input.projectId
                },
            })

            return createMessage;
        }),
}) 