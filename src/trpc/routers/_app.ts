import { messageRoute } from '@/modules/messages/server/procedure';
import { projectRoute } from '@/modules/projects/server/procedure';
import { usageRouter } from '@/modules/usage/server/procedure';
import { createTRPCRouter } from '../init';

export const appRouter = createTRPCRouter({
    message: messageRoute,
    projects: projectRoute,
    usage: usageRouter
})
// export type definition of API
export type AppRouter = typeof appRouter;