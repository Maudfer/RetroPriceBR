import "dotenv/config";
import { Worker, Queue } from "bullmq";
import type { Job } from "bullmq";
import { queueNames } from "@retroprice/shared";
import { computeRawScore } from "@retroprice/core";

const redisUrl = process.env.REDIS_URL ?? "redis://cache:6379";

const shouldRunQueues = redisUrl.length > 0;

if (!shouldRunQueues) {
  console.warn("[worker] REDIS_URL not set, skipping BullMQ bootstrap.");
} else {
  const connection = { url: redisUrl };

  const evidenceQueue = new Queue(queueNames.evidenceSanitization, { connection });

  const worker = new Worker(
    queueNames.evidenceSanitization,
    async (job: Job<{ reputation?: number }>) => {
      // Placeholder job handler until real sanitization pipeline is wired up.
      const score = computeRawScore({ baseWeight: 1, userReputation: job.data.reputation ?? 0 });

      console.log(`[worker] processed job ${job.id} -> score ${score.toFixed(2)}`);

      return { score };
    },
    { connection }
  );

  worker.on("completed", (job: Job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[worker] job ${job?.id} failed`, err);
  });

  // Emit a heartbeat job on boot in dev mode to prove the pipeline works.
  if (process.env.NODE_ENV !== "production") {
    void evidenceQueue
      .add("heartbeat", { reputation: 1 }, { removeOnComplete: true, removeOnFail: true })
      .catch((err: Error) => console.error("[worker] failed to enqueue heartbeat job", err));
  }
}
