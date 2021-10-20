// START CROSSDOMAIN

var redirect = function() {
  // First check to see if a cobrowse session is active
  // If not, proceed with the redirect as normal
  if (!GLANCE.Cobrowse.Visitor.inSession()) {
    window.location = "https://glancepro.online";
  }
  // If a session is active, then call continueSessionAt
  if (GLANCE.Cobrowse.Visitor.inSession()) {
    GLANCE.Cobrowse.Visitor.continueSessionAt({
      destination: "glancepro.online",
      oncomplete: function() {
        // Use the oncomplete method to perform the redirect
        // once the cookie has been written
        window.location = "https://glancepro.online";
      },
      iewarningsuppressed: true
    });
  }
};

window.addEventListener("load", event => {
  document
    .getElementById("redirect-button")
    .addEventListener("click", redirect);
});

// START ADDING SCRIPT TAG


function addCobrowseScript() {
  var websocket = "www.glance.net"
  var domain = "www"

  if (document.querySelector("#use-beta").checked) {
    websocket = "beta.glance.net"
    domain = "beta"
    document.querySelector("header").style.background = "#BF40BF"
    document.querySelector("#using-beta").innerText = "Yes"
  }

  var theCobrowseScript = document.createElement("script");
  var visitorId = document.getElementById("visitorId").value;
  var groupId = document.getElementById("groupId").value;
  var environment = document.getElementById("environment").value;
  theCobrowseScript.setAttribute("id", "glance-cobrowse");
  theCobrowseScript.setAttribute("type", "text/javascript");
  theCobrowseScript.setAttribute("data-groupid", groupId);
  theCobrowseScript.setAttribute("data-site", `${environment}`);
  theCobrowseScript.setAttribute("charset", "UTF-8");
  theCobrowseScript.setAttribute("data-visitorid", visitorId);
  theCobrowseScript.setAttribute("data-presence", "on");
  theCobrowseScript.setAttribute("data-ws", websocket);
  theCobrowseScript.setAttribute(
    "src",
    `https://${domain}.glancecdn.net/cobrowse/CobrowseJS.ashx?group=${groupId}&site=${environment}`
  );
  document.head.append(theCobrowseScript);
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
}

function sessionStarted() {
  console.log("the session has started");
  document.getElementById("loader").style.display = "none";
  document.getElementById("status-message").innerHTML = "";
}

function submitClicked() {
  console.log("submit button clicked at ", Date());
  const url = new URL(window.location);
  url.searchParams.set('groupid', document.getElementById("groupId").value);
  url.searchParams.set('environment', document.getElementById("environment").value);
  url.searchParams.set('visitorId', document.getElementById("visitorId").value);
  url.searchParams.set('beta', document.querySelector("#use-beta").checked);
  window.history.pushState({}, '', url)
  addCobrowseScript();
  hideUserInput();
  showLoader();
  document.getElementById("glance-cobrowse").onload = event => {
    GLANCE.Cobrowse.Visitor.addEventListener("sessionstart", sessionStarted);
  };
}

window.onload = event => {
  document
    .getElementById("visitor-id-button")
    .addEventListener("click", submitClicked);
    const urlParams = new URLSearchParams(window.location.search)
    const groupid = urlParams.get('groupid');
    const environment = urlParams.get('environment');
    const visitorId = urlParams.get('visitorId');
    const beta = urlParams.get('beta');
    if (groupid){
      document.getElementById("groupId").value = groupid
    }
    if (environment){
      document.getElementById("environment").value = environment
    }
    if (visitorId) {
      document.getElementById("visitorId").value = visitorId
    }
    if (beta == "true") {
      document.querySelector("#use-beta").checked = true
    }
};
