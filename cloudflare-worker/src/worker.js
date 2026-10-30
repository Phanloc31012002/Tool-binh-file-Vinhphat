// Worker cập nhật Công cụ bình. Nội dung (manifest, mã chung, chế độ khoá) do build-latest.mjs sinh ra
// trong ../generated/latest.js ngay trước mỗi lần deploy; thư mục generated/ không đưa lên Git.
import * as generated from "../generated/latest.js";
import { createHandler } from "./handler.js";

const handle = createHandler({
  latestJson: generated.latestJson,
  updateKey: typeof generated.updateKey === "string" ? generated.updateKey : "",
  batBuocMa: generated.batBuocMa === true,
});

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
