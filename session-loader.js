function hideModal() {
  console.log("hide the sessionstart modal");
  document.getElementById("session-loader").style.display = "none";
}

function startSessionWithLoader() {
  // Start the session.
  GLANCE.Cobrowse.Visitor.startSession("GLANCE_KEYTYPE_RANDOM");
  // If the visitor UI hasn't been loaded, then show custom spinner
  if (!GLANCE.Cobrowse.VisitorUI.loaded) {
    console.log("show the sessionstart modal");
    document.getElementById("session-loader").style.display = "block";
    // Hide the modal once the session starts and the Glance UI is displayed
    GLANCE.Cobrowse.Visitor.addEventListener("sessionstart", hideModal);
    return;
  }
}
