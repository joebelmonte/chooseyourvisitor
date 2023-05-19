(function() {'use strict';
window.XLSViewer = class {
  constructor(a) {
    if (a.data.error) {
      let c = document.querySelector("#message"), b = a.data.error;
      c.innerHTML = b.status ? "Unable to show XLS: got status " + b.status : "Unable to show XLS";
      document.querySelector("#the-page").style.display = "none";
      c.style.display = "block";
      c.classList.add("error");
    }
    document.querySelector("#closedoc").onclick = this.close.bind(this);
    5 < a.data.length / 1048576 ? (document.querySelector("#xls-toobig").style.display = "block", document.querySelector("#xls-loading").style.display = "none") : (this.workbook = XLSX.read(a.data, {type:"binary", cellStyles:!0}), this.currentIndex = 0, this.total = this.workbook.SheetNames.length, this.HTML = {}, this.HTML[this.currentIndex] = this.getHTML(), this.render(), document.querySelector("#tabtotal").innerText = this.total, a.options && a.options.hideDownload ? document.querySelector("#xlslink").style.display = 
    "none" : a.downloadURL && (document.querySelector("#xlslink").href = a.downloadURL), document.querySelector("#nextTab").onclick = this.nextTab.bind(this), document.querySelector("#prevTab").onclick = this.prevTab.bind(this));
  }
  getHTML() {
    var a = this.workbook.SheetNames[this.currentIndex];
    let c = this.workbook.Sheets[this.workbook.SheetNames[this.currentIndex]];
    var b = XLSX.utils.decode_range(c["!ref"]);
    let d = b.e.c, e = b.e.r;
    parseInt(12000 / d) < e && (b.e.r = parseInt(12000 / d), c["!ref"] = XLSX.utils.encode_range(b), a += " (showing first " + b.e.r + " rows of " + e + ")");
    return {content:XLSX.utils.sheet_to_html(c, {css:!0}), title:a};
  }
  close(a) {
    window.parent.postMessage("docviewerclosed");
  }
  nextTab() {
    this.currentIndex++;
    this.currentIndex >= this.total && (this.currentIndex = 0);
    this.generatePage();
    this.render();
  }
  prevTab() {
    this.currentIndex--;
    0 > this.currentIndex && (this.currentIndex = this.total - 1);
    this.generatePage();
    this.render();
  }
  generatePage() {
    this.HTML[this.currentIndex] || (this.HTML[this.currentIndex] = this.getHTML());
  }
  render() {
    document.querySelector("#the-page").setHTML('<div id="table-wrapper">' + this.HTML[this.currentIndex].content + "</div>");
    let a = document.querySelector("#table-wrapper");
    a.removeChild(a.childNodes[1]);
    document.querySelector("#xls-loading").style.display = "none";
    document.querySelector("#pageselect").innerText = this.currentIndex + 1;
    document.querySelector("#tabname").innerText = this.HTML[this.currentIndex].title;
  }
};
}).call(window);
