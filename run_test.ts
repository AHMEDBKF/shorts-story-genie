import { createProductionJob } from "./src/lib/pipeline/pipeline.server";
import { runWorkerTick } from "./src/lib/pipeline/worker.server";
const user = "b5ba1caf-d2ad-4367-bb9a-cad7c7ca1107";
const jobId = await createProductionJob(user, { lowCostMode: true, testMode: true, language: "ar" });
console.log("job", jobId);
for (let i = 0; i < 6; i++) {
  const r = await runWorkerTick();
  console.log(JSON.stringify(r));
}
