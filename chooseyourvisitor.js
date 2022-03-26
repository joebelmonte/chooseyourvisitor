function addCobrowseScript() {
  var websocket = "www.glance.net";
  var domain = "www.glancecdn.net";

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
  theCobrowseScript.setAttribute(
    "src",
    `https://${domain}/cobrowse/CobrowseJS.ashx?group=${groupId}&site=${environment}`
  );
  document.head.append(theCobrowseScript);

  theCobrowseScript.addEventListener("load", (e) => {
    document.getElementById(
      "cb-version"
    ).innerHTML = `Cobrowse script version: ${GLANCE.VERSION}`;
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
  document.getElementById(
    "presence-user-setting"
  ).innerHTML = document.getElementById("presence-setting").value;
  document.querySelector(
    "#environment-chosen"
  ).innerText = document.getElementById("environment").value;
}

function sessionStarted() {
  console.log("the session has started");
  document.getElementById("loader").style.display = "none";
  document.getElementById("status-message").innerHTML = "";
  document.getElementById("pause-session-button").disabled = false;
  document.querySelector("#pause-session-button").innerText = "Pause Session";
  document.querySelector("#glance_showing_status").innerText = "Showing Page";
  // Sessions should never start in a paused state.
  // However, I was noticing that if the previous session had started in a paused state,
  // then starting another session w/o refreshing the page would start it as paused, even if
  // The script tag attribute had been switched to 2
  GLANCE.Cobrowse.Visitor.pauseSession({ pause: false });
}

function sessionEnded() {
  document.getElementById("loader").style.display = "block";
  console.log("the session has ended");
  document.getElementById("pause-session-button").disabled = true;
  const url = new URL(window.location);
  url.searchParams.set("paused", "false");
  window.history.pushState({}, "", url);
  document.getElementById("glance-cobrowse").dataset.startpaused = 2;
  document.querySelector("#pause-session-button").innerText = "Pause Session";
}

function addPauseMessageToGlanceUi() {
  // I want to update the Glance UI with a message that the session has been paused
  // but it hasn't been loaded at this point. So I'm setting up a mutation observer
  // to listen for when it gets added.

  // Select the node that will be observed for mutations
  const targetNode = document.querySelector("body");

  // Options for the observer (which mutations to observe)
  const config = { attributes: true, childList: true, subtree: true };

  // Callback function to execute when mutations are observed
  const callback = function (mutationsList, observer) {
    for (const mutation of mutationsList) {
      if (mutation.target.id === "glance_titlebar") {
        console.log("mutation.type is :", mutation.type);
        document.querySelector("#glance_showing_status").innerText =
          "Paused...";
        // Don't need to observe anymore
        observer.disconnect();
      }
    }
  };

  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);

  // Start observing the target node for configured mutations
  observer.observe(targetNode, config);
}

function checkPausedState() {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("paused") == "true") {
    document.querySelector("#pause-session-button").innerText =
      "Unpause Session";
    document.getElementById("pause-session-button").disabled = false;
    addPauseMessageToGlanceUi();
  }
}

function sessionContinued() {
  if (!GLANCE.Cobrowse.Visitor.isSessionPaused()) {
    document.getElementById("pause-session-button").disabled = false;
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
    "autoload",
    document.querySelector("#auto-load").checked
  );
  document.querySelector(
    "#auto-load-post-load"
  ).checked = document.querySelector("#auto-load").checked;
  window.history.pushState({}, "", url);
  addCobrowseScript();
  hideUserInput();
  showLoader();
  document.getElementById("glance-cobrowse").onload = (event) => {
    GLANCE.Cobrowse.Visitor.addEventListener("sessionstart", sessionStarted);
    GLANCE.Cobrowse.Visitor.addEventListener("sessionend", sessionEnded);
    GLANCE.Cobrowse.Visitor.addEventListener(
      "sessioncontinue",
      sessionContinued
    );
    checkPausedState();
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
    document.querySelector("#glance_showing_status").innerText = "Paused...";
    url.searchParams.set("paused", "true");
    window.history.pushState({}, "", url);
  } else {
    GLANCE.Cobrowse.Visitor.pauseSession({ pause: false });
    document.querySelector("#pause-session-button").innerText = "Pause Session";
    document.querySelector("#glance_showing_status").innerText = "Showing Page";
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
  const autoLoad = urlParams.get("autoload");
  const presence = urlParams.get("presence");
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
});
