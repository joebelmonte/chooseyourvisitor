
function getAllowedRoles() {
  var allowedRoles = document.querySelector("#allowed-roles").value
  var allowedRolesArray = allowedRoles.split(',')
  var allowedRolesArrayTrimmed = allowedRolesArray.map(role => role.trim())
  return allowedRolesArrayTrimmed
}

function shouldPageBeMasked(params) {
  // Get the list of allowed roles from the input field
  var allowedRolesList = getAllowedRoles()

  // If the Allowed Role input was left blank, allowedRolesList will be an array of length 1 with value of ''.
  // We don't want to mask the page in this situation.
  if (allowedRolesList.length === 1 && allowedRolesList[0] === "") {
    return false
  }

  // Get the list of participants in the session.
  // This will include agents and possibly guests
  var participantList = params.agents.agentlist

  // Filter out the guests -> guests do not have an agentrole property
  var agentlist = participantList.filter(participant => participant.agentrole)

  // Now decide whether the page should be masked by comparing the roles of the agents in the session
  // with the list of allowed roles entered in the input field.

  // The logic here is that every agent in the session must be in a role that's included in the allowed list
  // If even 1 agent is in a role not on the allowed list, then the page is masked for all participants
  return !agentlist.every(agent => allowedRolesList.includes(agent.agentrole))
}

// Hook function called by cobrowse script to get masking information
GLANCE_COBROWSE.getMaskingDescriptor = async function (params) {
    return new Promise(async (resolve, reject) => {

        let maskingdescriptor = {};

        // If agent information is not yet available, mask the entire page
        try {
          if (!params.agents || params.agents.count === 0)
            maskingdescriptor.maskpage = true
          else (
            maskingdescriptor.maskpage = shouldPageBeMasked(params)
          )
        } catch(e) {
          console.log("Masking descriptor error: ", e)
          console.log(`You are on version ${GLANCE.VERSION} of Glance.  5.2+ required.`)
        }
        console.log('maskingdescriptor is ', maskingdescriptor)
        resolve(maskingdescriptor);
    })
}
