export const healthHandler = async (request: any, reply: any) => {
    return {
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    };
};
