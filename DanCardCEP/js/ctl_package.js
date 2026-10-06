/* CTL AI/JPG -> mỗi tờ một file ZIP phẳng. Dùng API tiến trình gốc của Adobe CEP;
 * không cần cờ cấp quyền Node, không nội suy vào shell, không sửa file nguồn, không IO mạng.
 * CEP API: github.com/Adobe-CEP/CEP-Resources/CEP_12.x/CEPEngine_extensions.js
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DanCardCtlPackage = api;
})(this, function () {
  "use strict";
  function absolute(p) {
    p = String(p || "").replace(/\\/g, "/");
    if (
      !/^(?:[A-Za-z]:\/|\/\/[^/]+\/[^/]+\/)/.test(p) ||
      /[\x00-\x1f]/.test(p) ||
      /(?:^|\/)\.\.?(?:\/|$)/.test(p)
    )
      throw Error("Đường dẫn đóng gói không hợp lệ.");
    return p.replace(/\/$/, "");
  }
  function validate(plan) {
    if (!plan || !plan.jobs || !plan.jobs.length || plan.jobs.length > 1000)
      throw Error("Thiếu danh sách AI/JPG để nén.");
    var folder = absolute(plan.folder),
      jobs = [],
      names = {};
    for (var i = 0; i < plan.jobs.length; i++) {
      var job = plan.jobs[i],
        name = String(job.baseName || "");
      if (!name || /[\\/:*?"<>|\x00-\x1f]/.test(name) || /[. ]$/.test(name))
        throw Error("Tên ZIP không hợp lệ.");
      if (names[name.toLowerCase()]) throw Error("Hai bộ trùng tên ZIP.");
      names[name.toLowerCase()] = true;
      var next = { baseName: name };
      for (var k = 0; k < 3; k++) {
        var ext = ["ai", "jpg", "zip"][k],
          path = absolute(job[ext]);
        if (
          path.toLowerCase() !== (folder + "/" + name + "." + ext).toLowerCase()
        )
          throw Error("AI/JPG/ZIP phải cùng tên và cùng thư mục.");
        next[ext] = path;
      }
      jobs.push(next);
    }
    return { folder: folder, jobs: jobs };
  }
  function utf16Base64(s, btoa) {
    var bytes = "";
    for (var i = 0; i < s.length; i++)
      bytes += String.fromCharCode(
        s.charCodeAt(i) & 255,
        s.charCodeAt(i) >>> 8,
      );
    return btoa(bytes);
  }
  function command(plan, statusPath, btoa) {
    validate(plan);
    // Đọc cả lô dưới dạng dữ liệu JSON, không qua tham số shell. Câu lệnh vẫn
    // ngắn dù có nhiều tờ và tên file tiếng Việt dài.
    var payload = btoa(unescape(encodeURIComponent(absolute(statusPath))));
    return [
      "$ErrorActionPreference='Stop'",
      "$ctlStatus=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" +
        payload +
        "'))",
      "$ctlData=[IO.File]::ReadAllText($ctlStatus,[Text.Encoding]::UTF8) | ConvertFrom-Json",
      "$ctlResults=@(); $ctlErrors=@()",
      "try {",
      "Add-Type -AssemblyName System.IO.Compression",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem",
      "$ctlRoot=[IO.Path]::GetFullPath($ctlData.folder)",
      "foreach($ctlJob in $ctlData.jobs) {",
      "$ctlTemp=$null; $ctlArchive=$null; $ctlOutput=$null",
      "try {",
      "$ctlPaths=@($ctlJob.ai,$ctlJob.jpg,$ctlJob.zip)",
      "foreach($ctlPath in $ctlPaths) { if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ctlPath)) -ne $ctlRoot) { throw 'File outside output folder' } }",
      "if([IO.File]::Exists($ctlJob.zip)) { throw 'ZIP already exists; not overwritten' }",
      "$ctlFiles=@(Get-Item -LiteralPath $ctlJob.ai, $ctlJob.jpg)",
      "if($ctlFiles.Count -ne 2 -or $ctlFiles[0].PSIsContainer -or $ctlFiles[1].PSIsContainer -or $ctlFiles[0].Length -le 0 -or $ctlFiles[1].Length -le 0) { throw 'Missing or empty AI/JPG' }",
      "$ctlTemp=[IO.Path]::Combine($ctlRoot,'.ctlzip_'+[Guid]::NewGuid().ToString('N')+'.tmp')",
      "$ctlOutput=[IO.File]::Open($ctlTemp,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)",
      "$ctlArchive=[IO.Compression.ZipArchive]::new($ctlOutput,[IO.Compression.ZipArchiveMode]::Create,$false,[Text.Encoding]::UTF8)",
      "try { foreach($ctlFile in $ctlFiles) {",
      "$ctlEntry=$ctlArchive.CreateEntry($ctlFile.Name,[IO.Compression.CompressionLevel]::Optimal)",
      "$ctlInput=$null; $ctlEntryStream=$null",
      "try { $ctlInput=[IO.File]::OpenRead($ctlFile.FullName); $ctlEntryStream=$ctlEntry.Open(); $ctlInput.CopyTo($ctlEntryStream) }",
      "finally { if($ctlEntryStream) { $ctlEntryStream.Dispose() }; if($ctlInput) { $ctlInput.Dispose() } }",
      "} } finally { $ctlArchive.Dispose(); $ctlArchive=$null; $ctlOutput=$null }",
      "$ctlCheck=[IO.Compression.ZipFile]::OpenRead($ctlTemp)",
      "try { if($ctlCheck.Entries.Count -ne 2) { throw 'ZIP entry count mismatch' }; foreach($ctlFile in $ctlFiles) { $ctlFound=$ctlCheck.GetEntry($ctlFile.Name); if(-not $ctlFound -or $ctlFound.Length -ne $ctlFile.Length) { throw 'ZIP entry mismatch' } } } finally { $ctlCheck.Dispose() }",
      "[IO.File]::Move($ctlTemp,$ctlJob.zip); $ctlTemp=$null",
      "$ctlResults+=@{name=$ctlJob.baseName;zip=$ctlJob.zip}",
      "} catch { $ctlErrors+=@{name=$ctlJob.baseName;error=$_.Exception.Message} }",
      "finally { if($ctlArchive) { $ctlArchive.Dispose() }; if($ctlOutput) { $ctlOutput.Dispose() }; if($ctlTemp -and [IO.File]::Exists($ctlTemp)) { [IO.File]::Delete($ctlTemp) } }",
      "}",
      "} catch { $ctlErrors+=@{name='ZIP';error=$_.Exception.Message} }",
      "$ctlJson=ConvertTo-Json -Compress -Depth 5 -InputObject @{done=$true;files=@($ctlResults);errors=@($ctlErrors)}",
      "[IO.File]::WriteAllText($ctlStatus,$ctlJson,[Text.UTF8Encoding]::new($false))",
    ].join("\r\n");
  }
  function supported(env) {
    env = env || window;
    return !!(
      env.cep &&
      env.cep.fs &&
      env.cep.process &&
      typeof env.cep.process.createProcess === "function" &&
      typeof env.cep.fs.stat === "function" &&
      typeof env.cep.fs.writeFile === "function" &&
      typeof env.cep.fs.readFile === "function" &&
      typeof env.cep.fs.deleteFile === "function" &&
      typeof env.btoa === "function"
    );
  }
  function pack(plan, onStatus, done, env) {
    env = env || window;
    var statusPath = null,
      ownsStatus = false,
      finished = false,
      stoppedChecks = 0,
      started = Date.now();
    function finish(error, result) {
      if (finished) return;
      finished = true;
      if (ownsStatus) {
        try {
          env.cep.fs.deleteFile(statusPath);
        } catch (e) {}
      }
      done(error, result);
    }
    try {
      if (!supported(env)) throw Error("Không có bộ nén CEP trên máy này.");
      var data = validate(plan);
      var system = absolute(plan.system),
        temp = absolute(plan.temp);
      statusPath =
        temp +
        "/CTL_zip_" +
        Date.now() +
        "_" +
        Math.floor(Math.random() * 100000000) +
        ".json";
      if (env.cep.fs.stat(statusPath).err !== 3)
        throw Error("Trùng file trạng thái ZIP; hãy thử lại.");
      data.pending = true;
      var written = env.cep.fs.writeFile(
        statusPath,
        JSON.stringify(data),
        "UTF-8",
      );
      if (written.err !== 0) throw Error("Không tạo được trạng thái nén ZIP.");
      ownsStatus = true;
      var btoa = function (s) {
        return env.btoa(s);
      };
      var script = command(plan, statusPath, btoa);
      var launched = env.cep.process.createProcess(
        system + "/WindowsPowerShell/v1.0/powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-EncodedCommand",
        utf16Base64(script, btoa),
      );
      if (launched.err !== 0 || launched.data <= 0)
        throw Error(
          "Không khởi động được bộ nén ZIP (lỗi " + launched.err + ").",
        );
      onStatus("Đang nén " + plan.jobs.length + " bộ AI + JPG…");
      function poll() {
        if (finished) return;
        try {
          var read = env.cep.fs.readFile(statusPath, "UTF-8"),
            result = null;
          if (read.err === 0) {
            try {
              result = JSON.parse(read.data);
            } catch (e) {}
          }
          if (result && result.done) {
            finish(null, result);
            return;
          }
          if (Date.now() - started > 1800000) {
            // Worker có thể vẫn đang ghi; khi timeout thì để nguyên trạng thái của nó.
            ownsStatus = false;
            finish(Error("Nén ZIP quá lâu; AI/JPG đã giữ nguyên."));
            return;
          }
          if (env.cep.process.isRunning) {
            var running = env.cep.process.isRunning(launched.data);
            if (running.err === 0 && !running.data && ++stoppedChecks > 1) {
              finish(
                Error("Bộ nén dừng chưa có kết quả; AI/JPG đã giữ nguyên."),
              );
              return;
            }
            if (running.err === 0 && running.data) stoppedChecks = 0;
          }
          env.setTimeout(poll, 500);
        } catch (e) {
          finish(e);
        }
      }
      env.setTimeout(poll, 500);
    } catch (e) {
      finish(e);
    }
  }
  return {
    pack: pack,
    supported: supported,
    validate: validate,
    command: command,
    utf16Base64: utf16Base64,
  };
});
