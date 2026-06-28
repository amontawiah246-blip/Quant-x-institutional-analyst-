const AdmZip = require("adm-zip");
const zip = new AdmZip("archive.zip");
zip.extractAllTo(".", true);
console.log("Extracted");
