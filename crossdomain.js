// var contSession = function() {
//   GLANCE.Cobrowse.Visitor.continueSessionAt({
//     destination: "glancepro.online",
//     oncomplete: function() {
//       console.log("session continued on glancepro.online");
//     },
//     iewarningsuppressed: true
//   });
// };

function redirectCrossDomain() {
  console.log("in redirectCrossDomain");
  // If session is active, call crossDomain
  // Otherwise, proceed with the redirect as normal
  if (GLANCE.Cobrowse.Visitor.inSession()){
    var params = { url: "https://glancepro.online/", target: "_self" };
    GLANCE.Cobrowse.Visitor.crossDomain(params);
  } else {
    window.location = "https://glancepro.online"
  }
}

function redirectPromptCrossDomain() {
  console.log("in redirectPromptCrossDomain");
  // If session is active, call promptCrossDomain
  // Otherwise, proceed with the redirect as normal
  if (GLANCE.Cobrowse.Visitor.inSession()) {
    var params = { url: "https://glancepro.online/", target: "_self" };
    GLANCE.Cobrowse.VisitorUI.promptCrossDomain(params);
  } else {
    window.location = "https://glancepro.online"
  }
}

window.addEventListener("load", event => {
  document
    .getElementById("redirectCrossDomain")
    .addEventListener("click", redirectCrossDomain);
});

window.addEventListener("load", event => {
  document
    .getElementById("redirectPromptCrossDomain")
    .addEventListener("click", redirectPromptCrossDomain);
});
