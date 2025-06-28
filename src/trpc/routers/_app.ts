import { messageRoute } from '@/modules/messages/server/procedure';
import { createTRPCRouter } from '../init';
import { projectRoute } from '@/modules/projects/server/procedure';

export const appRouter = createTRPCRouter({
    message: messageRoute,
    projects: projectRoute
})
// export type definition of API
export type AppRouter = typeof appRouter;