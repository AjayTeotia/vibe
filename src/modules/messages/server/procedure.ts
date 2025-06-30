import { inngest } from "@/inngest/client"
import prisma from "@/lib/db"
import { consumeCredits } from "@/lib/usage"
import { protectedProcedure, createTRPCRouter } from "@/trpc/init"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

export const messageRoute = createTRPCRouter({
    getMany: protectedProcedure
        .input(
            z.object({
                projectId: z.string()
                    .min(1, { message: "Project is required" })
            })
        )
        .query(async ({ input, ctx }) => {
            const message = await prisma.message.findMany({
                where: {
                    projectId: input.projectId,
                    Project: {
                        userId: ctx.auth.userId
                    }
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

    create: protectedProcedure
        .input(
            z.object({
                value: z.string()
                    .min(1, { message: "Message is required" })
                    .max(10000, { message: "Message is too long" }),
                projectId: z.string()
                    .min(1, { message: "Project is required" })
            })
        )
        .mutation(async ({ input, ctx }) => {
            const exitingProject = await prisma.project.findUnique({
                where: {
                    id: input.projectId,
                    userId: ctx.auth.userId
                }
            });

            if (!exitingProject) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" })
            }

            try {
                await consumeCredits();
            } catch (error) {
                if (error instanceof Error) {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: error.message })
                } else {
                    throw new TRPCError({
                        code: "TOO_MANY_REQUESTS",
                        message: "You have reached your request limit"
                    })
                }
            }

            const createMessage = await prisma.message.create({
                data: {
                    content: input.value,
                    projectId: exitingProject.id,
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