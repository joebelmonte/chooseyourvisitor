function viewExcel(){
  if (GLANCE.Cobrowse.Visitor.inSession() && GLANCE.Cobrowse.Visitor.viewXLS){
    GLANCE.Cobrowse.Visitor.viewXLS({url: "https://joebelmonte.site/resources/Example.xlsx"})
  } else if (GLANCE.Cobrowse.Visitor.inSession() && !GLANCE.Cobrowse.Visitor.viewXLS) {
    console.log('Version ' + GLANCE.VERSION + ' of Cobrowse does not support viewing of Excel files in session.')
    window.open("https://joebelmonte.site/resources/Example.xlsx")
  } else {
    window.open("https://joebelmonte.site/resources/Example.xlsx")
  }
}

document.getElementById("excel-viewer").addEventListener("click", viewExcel)
