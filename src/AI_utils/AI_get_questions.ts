/*
Responsible for fetching next questions based off of current answers of the user
*/
import { fal } from "@fal-ai/client";

fal.config({
    credentials: process.env.REACT_APP_FAL_API_KEY || '',
});

export async function getAIResponse(prompt: string){
    const result = await fal.subscribe("fal-ai/flux-krea-lora/stream", {
        input: { prompt },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                update.logs?.map((log) => log.message).forEach(console.log);
            }
        },
    });

    return result;
    // Assuming the AI response is in result.data.text
}