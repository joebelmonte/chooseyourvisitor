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
  document.querySelector("#allowed-roles-list").innerText = document.querySelector("#allowed-roles").value
  document.querySelector("#environment-chosen").innerText = document.getElementById("environment").value;
}

function sessionStarted() {
  console.log("the session has started");
  document.getElementById("loader").style.display = "none";
  document.getElementById("status-message").innerHTML = "";
}

function getAllowedRoles() {
  var allowedRoles = document.querySelector("#allowed-roles").value
  var allowedRolesArray = allowedRoles.split(',')
  var allowedRolesArrayTrimmed = allowedRolesArray.map(role => role.trim())
  return allowedRolesArrayTrimmed
}

function shouldPageBeMasked(params) {
  var allowedRolesList = getAllowedRoles()
  var agentlist = params.agents.agentlist
  // If the Allowed Role input was left blank, allowedRolesList will be an array of length 1 with value of ''.
  // We don't want to mask the page in this situation.
  if (allowedRolesList.length === 1 && allowedRolesList[0] === "") {
    return false
  }
  // The logic here is that every agent in the session must be in a role that's included in the allowed list
  // If even 1 agent is in a role not on the allowed list, then the page is masked for all agents
  return !agentlist.every(agent => allowedRolesList.includes(agent.agentrole))
}

// Hook function called by cobrowse script to get masking information
var GLANCE_COBROWSE = {}
GLANCE_COBROWSE.getMaskingDescriptor = async function (params) {
    return new Promise(async (resolve, reject) => {

        let maskingdescriptor = {};

        // If agent information is not yet available, mask everything with a data-agentrole attribute
        if (!params.agents || params.agents.count === 0)
          maskingdescriptor.maskpage = false
        else (
          maskingdescriptor.maskpage = shouldPageBeMasked(params)
        )
        console.log('maskingdescriptor is ', maskingdescriptor)
        resolve(maskingdescriptor);
    })
}

function submitClicked() {
  console.log("submit button clicked at ", Date());
  const url = new URL(window.location);
  url.searchParams.set('groupid', document.getElementById("groupId").value);
  url.searchParams.set('environment', document.getElementById("environment").value);
  url.searchParams.set('visitorId', document.getElementById("visitorId").value);
  url.searchParams.set('beta', document.querySelector("#use-beta").checked);
  url.searchParams.set('allowedroles', encodeURI(document.querySelector("#allowed-roles").value));
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
    const allowedroles = urlParams.get('allowedroles');
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
    if (allowedroles) {
      document.querySelector("#allowed-roles").value = decodeURI(allowedroles)
    }
};
