// window.addEventListener("load", event => {
//   document
//     .getElementById("redirectPromptCrossDomain")
//     .addEventListener("click", redirectPromptCrossDomain);
// });

function pdfRedirect() {
  var params = {
    url: "https://joebelmonte.site/resources/Glance_User_Provisioning_API.pdf"
  };
  if (GLANCE.Cobrowse.Visitor.inSession()) {
    GLANCE.Cobrowse.Visitor.viewPDF(params);
  } else
    window.open(
      "https://joebelmonte.site/resources/Glance_User_Provisioning_API.pdf",
      "_self"
    );
}

window.addEventListener("load", event => {
  document.getElementById("pdf-js").addEventListener("click", pdfRedirect);
});
