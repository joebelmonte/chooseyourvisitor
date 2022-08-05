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

function addCobrowseScript() {
  var websocket = "www.glance.net";
  var domain = "www.glancecdn.net";
  var src = "";

  const urlParams = new URLSearchParams(window.location.search);
  const paused = urlParams.get("paused") === "true" ? 1 : 2;

  if (document.querySelector("#website").value == "beta") {
    websocket = "beta.glance.net";
    domain = "beta.glancecdn.net";
    document.querySelector("header").style.background = "#BF40BF";
    document.querySelector("#using-website").innerText = "beta.glance.net";
  } else if (document.querySelector("#website").value == "myglance") {
    websocket = "www.myglance.net";
    domain = "cdn.myglance.net";
    document.querySelector("header").style.background = "#e74c3c";
    document.querySelector("#using-website").innerText = "myglance.net";
  }

  var theCobrowseScript = document.createElement("script");
  var visitorId = document.getElementById("visitorId").value;
  var groupId = document.getElementById("groupId").value;
  var environment = document.getElementById("environment").value;
  var presenceSetting = document.getElementById("presence-setting").value;
  var video = document.getElementById("video-at-start").value;
  theCobrowseScript.setAttribute("id", "glance-cobrowse");
  theCobrowseScript.setAttribute("type", "text/javascript");
  theCobrowseScript.setAttribute("data-groupid", groupId);
  if (presenceSetting != "off") {
    theCobrowseScript.setAttribute("data-presence", `${presenceSetting}`);
  }
  theCobrowseScript.setAttribute("data-site", `${environment}`);
  theCobrowseScript.setAttribute("charset", "UTF-8");
  theCobrowseScript.setAttribute("data-visitorid", visitorId);
  theCobrowseScript.setAttribute("data-ws", websocket);
  theCobrowseScript.setAttribute("data-startpaused", `${paused}`);
  if (video != "default") {
    theCobrowseScript.setAttribute("data-video", `${video}`);
  }
  if (document.getElementById("self-hosted").value != "") {
    var version = document.getElementById("self-hosted").value;
    src = `./self-hosted-scripts/cobrowse_${version}/js/GlanceCobrowseLoader_${version}M.js`;
  } else {
    src = `https://${domain}/cobrowse/CobrowseJS.ashx?group=${groupId}&site=${environment}`;
  }
  theCobrowseScript.setAttribute("src", src);
  document.head.append(theCobrowseScript);

  theCobrowseScript.addEventListener("load", (e) => {
    document.getElementById("cb-version").innerHTML =
      `Cobrowse script version: ${GLANCE.VERSION}` + ` patch ${GLANCE.PATCH}`;
  });
}

function hideUserInput() {
  document.getElementById("user-input").style.display = "none";
}

function showLoader() {
  document.getElementById("user-feedback").style.display = "block";
  document.getElementById("visitor-id").innerHTML = document.getElementById(
    "visitorId"
  ).value;
  document.getElementById("group-id").innerHTML = document.getElementById(
    "groupId"
  ).value;
  document.getElementById("video-setting").innerHTML = document.getElementById(
    "video-at-start"
  ).value;
  document.getElementById(
    "presence-user-setting"
  ).innerHTML = document.getElementById("presence-setting").value;
  document.querySelector(
    "#environment-chosen"
  ).innerText = document.getElementById("environment").value;
}

function checkPausedState() {
  var urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("paused") == "true") {
    document.querySelector("#pause-session-button").innerText =
      "Unpause Session";
    document.getElementById("paused-message").style.display = "block";
  }
}

function submitClicked() {
  console.log("submit button clicked at ", Date());
  const url = new URL(window.location);
  url.searchParams.set(
    "presence",
    document.getElementById("presence-setting").value
  );
  url.searchParams.set("groupid", document.getElementById("groupId").value);
  url.searchParams.set(
    "environment",
    document.getElementById("environment").value
  );
  url.searchParams.set("visitorId", document.getElementById("visitorId").value);
  url.searchParams.set("website", document.querySelector("#website").value);
  url.searchParams.set(
    "video",
    document.querySelector("#video-at-start").value
  );
  url.searchParams.set(
    "autoload",
    document.querySelector("#auto-load").checked
  );
  url.searchParams.set(
    "selfhost",
    document.getElementById("self-hosted").value
  );
  document.querySelector(
    "#auto-load-post-load"
  ).checked = document.querySelector("#auto-load").checked;
  window.history.pushState({}, "", url);
  addCobrowseScript();
  hideUserInput();
  showLoader();
  document.getElementById("glance-cobrowse").onload = (event) => {
    glanceSessionEventListeners();
  };
}

function pauseSession() {
  const url = new URL(window.location);
  if (!GLANCE.Cobrowse.Visitor.isSessionPaused()) {
    var params = {
      pause: true,
      message: document.querySelector("#pause-session-message").value,
    };
    GLANCE.Cobrowse.Visitor.pauseSession(params);
    document.querySelector("#pause-session-button").innerText =
      "Unpause Session";
    document.getElementById("paused-message").style.display = "block";
    url.searchParams.set("paused", "true");
    window.history.pushState({}, "", url);
  } else {
    GLANCE.Cobrowse.Visitor.pauseSession({ pause: false });
    document.querySelector("#pause-session-button").innerText = "Pause Session";
    document.getElementById("paused-message").style.display = "none";
    url.searchParams.set("paused", "false");
    window.history.pushState({}, "", url);
  }
}

window.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");
  document
    .getElementById("visitor-id-button")
    .addEventListener("click", submitClicked);
  const urlParams = new URLSearchParams(window.location.search);
  const groupid = urlParams.get("groupid");
  const environment = urlParams.get("environment");
  const visitorId = urlParams.get("visitorId");
  const website = urlParams.get("website");
  const video = urlParams.get("video");
  const autoLoad = urlParams.get("autoload");
  const presence = urlParams.get("presence");
  const selfHost = urlParams.get("selfhost");
  if (presence) {
    document.getElementById("presence-setting").value = presence;
  }
  if (groupid) {
    document.getElementById("groupId").value = groupid;
  }
  if (environment) {
    document.getElementById("environment").value = environment;
  }
  if (visitorId) {
    document.getElementById("visitorId").value = visitorId;
  }
  if (website == "beta") {
    document.querySelector("#website").value = "beta";
  }
  if (website == "myglance") {
    document.querySelector("#website").value = "myglance";
  }
  if (video) {
    document.querySelector("#video-at-start").value = video;
  }
  if (selfHost) {
    document.querySelector("#self-hosted").value = selfHost;
  }
  if (autoLoad == "true") {
    document.querySelector("#auto-load").checked = true;
    document.querySelector("#auto-load-post-load").checked = true;
    submitClicked();
  }

  document
    .querySelector("#auto-load-post-load")
    .addEventListener("change", (event) => {
      const url = new URL(window.location);
      url.searchParams.set(
        "autoload",
        document.querySelector("#auto-load-post-load").checked
      );
      window.history.pushState({}, "", url);
    });

  document
    .querySelector("#pause-session-button")
    .addEventListener("click", (event) => {
      console.log("session pause button clicked.");
      pauseSession();
    });

  document
    .querySelector("#change-visitor-id")
    .addEventListener("click", (event) => {
      if (typeof GLANCE.Presence.Visitor.setVisitorId === "function") {
        var newVisitorId = prompt("Enter new visitor id.");
        GLANCE.Presence.Visitor.setVisitorId(newVisitorId);
        document.getElementById("visitor-id").innerHTML = newVisitorId;
        const url = new URL(window.location);
        url.searchParams.set("visitorId", newVisitorId);
        window.history.pushState({}, "", url);
      } else {
        alert("Only available on cobrowse version 5.4+.");
      }
    });
});
