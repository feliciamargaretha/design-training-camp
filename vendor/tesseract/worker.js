// Starts the Tesseract worker. Claude artifacts don't serve .gz files, so the
// English data ships as eng.traineddata.gz.wasm; point Tesseract's request
// for eng.traineddata.gz at it. Tesseract unpacks the gzip itself.
(function () {
  var nativeFetch = self.fetch.bind(self);
  self.fetch = function (input, init) {
    if (typeof input === "string" && /\/eng\.traineddata\.gz$/.test(input)) {
      input = input + ".wasm";
    }
    return nativeFetch(input, init);
  };
})();
importScripts("worker.min.js");
