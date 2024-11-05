// Session event listeners

function sessionstarting() {
  console.log("GLANCE SESSION LISTENER: sessionstarting has fired");
}

function sessionStarted() {
  console.log("GLANCE SESSION LISTENER: sessionstart has fired");
  document.getElementById("loader").style.display = "none";
  document.getElementById("status-message").innerHTML = "";
  if (GLANCE.Cobrowse.Visitor.pauseSession) {
    // Putting this in an if statement to make it backwards compatible with older versions of CB
    // Sessions should never start in a paused state.
    // However, I was noticing that if the previous session had started in a paused state,
    // then starting another session w/o refreshing the page would start it as paused, even if
    // The script tag attribute had been switched to 2
    document.getElementById("pause-session-button").disabled = false;
    document.getElementById("pause-session-button").setAttribute("title", "");
    document.querySelector("#pause-session-button").innerText = "Pause Session";
    GLANCE.Cobrowse.Visitor.pauseSession({ pause: false });
  }
  // Automatically copy the session key to the clipboard
  var sessionKey = GLANCE.Cobrowse.Visitor.getKey();
  navigator.clipboard
    .writeText(sessionKey)
    .then((e) => console.log("Session key copied: ", sessionKey))
    .catch((e) => console.log("Error copying session key: ", e));
}

function checkPausedState() {
  var urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("paused") == "true") {
    document.querySelector("#pause-session-button").innerText =
      "Unpause Session";
    document.getElementById("paused-message").style.display = "block";
  }
}

function sessionContinued() {
  console.log("GLANCE SESSION LISTENER: sessioncontinue has fired");
  if (typeof GLANCE.Cobrowse.Visitor.pauseSession == "function") {
    document.getElementById("pause-session-button").disabled = false;
    document.getElementById("pause-session-button").setAttribute("title", "");
    checkPausedState();
  }
}

function sessionEnded() {
  console.log("GLANCE SESSION LISTENER: sessionend has fired");
  document.getElementById("loader").style.display = "block";
  console.log("the session has ended");
  document.getElementById("pause-session-button").disabled = true;
  document
    .getElementById("pause-session-button")
    .setAttribute("title", "Only available during sessions running CB v 5.1+.");
  const url = new URL(window.location);
  url.searchParams.set("paused", "false");
  window.history.pushState({}, "", url);
  document.getElementById("glance-cobrowse").dataset.startpaused = 2;
  document.querySelector("#pause-session-button").innerText = "Pause Session";
}

function screenshare(e) {
  console.log(`GLANCE SESSION LISTENER: screenshare has fired: `, e);
}

function agents(e) {
  console.log(`GLANCE SESSION LISTENER: agents has fired: `, e);
}

function rcevent(e) {
  console.log("GLANCE SESSION LISTENER: rcevent has fired: ", e);
  console.log(
    "The element that was touched was: ",
    document.querySelector(e.path)
  );
  if (document.querySelector(e.path).value) {
    console.log("The value is ", document.querySelector(e.path).value);
  }
}

function rc(e) {
  var status = e.enabled === true ? "started" : "ended";
  console.log(`GLANCE SESSION LISTENER: Selective Editing has ${status}.`, e);
}

function rcrequested(callback) {
  console.log("GLANCE SESSION LISTENER: Selective Editing has been requested.");
  callback.accept = function () {
    console.log("Selective editing accepted.");
    GLANCE.Cobrowse.Visitor.enableRC(true);
  };
  callback.decline = function () {
    console.log("Selective editing declined.");
    GLANCE.Cobrowse.Visitor.enableRC(false);
  };
}

function glanceSessionEventListeners() {
  GLANCE.Cobrowse.Visitor.addEventListener("sessionstarting", sessionstarting);
  GLANCE.Cobrowse.Visitor.addEventListener("sessionstart", sessionStarted);
  GLANCE.Cobrowse.Visitor.addEventListener("sessioncontinue", sessionContinued);
  GLANCE.Cobrowse.Visitor.addEventListener("sessionend", sessionEnded);
  GLANCE.Cobrowse.Visitor.addEventListener("screenshare", screenshare);
  GLANCE.Cobrowse.Visitor.addEventListener("agents", agents);
  GLANCE.Cobrowse.Visitor.addEventListener("rcevent", rcevent);
  GLANCE.Cobrowse.Visitor.addEventListener("rc", rc);
  GLANCE.Cobrowse.Visitor.addEventListener("rcrequested", rcrequested);
}

export { glanceSessionEventListeners };
