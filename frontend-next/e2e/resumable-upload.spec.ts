import { test, expect } from "@playwright/test";
import { apiURL, fetchCsrf, registerAndLogin, uniqueUsername } from "./helpers/auth";
import { minimalWavBytes } from "./helpers/minimal-wav";

test("chunked track upload init and status", async ({ request }) => {
  const user = uniqueUsername("upload");
  await registerAndLogin(request, user);
  const csrf = await fetchCsrf(request);
  const wav = minimalWavBytes();

  const init = await request.post(`${apiURL}/api/tracks/upload/init`, {
    data: {
      filename: "chunk.wav",
      size: wav.length,
      title: "Chunk E2E",
    },
    headers: { "X-CSRFToken": csrf },
  });
  expect(init.ok()).toBeTruthy();
  const session = (await init.json()) as { upload_id: string };

  const status = await request.get(`${apiURL}/api/tracks/upload/${session.upload_id}/status`, {
    headers: { "X-CSRFToken": csrf },
  });
  expect(status.ok()).toBeTruthy();
  const st = (await status.json()) as { bytes_received: number };
  expect(st.bytes_received).toBe(0);
});
