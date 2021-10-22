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
          maskingdescriptor.maskpage = true
        else (
          maskingdescriptor.maskpage = shouldPageBeMasked(params)
        )
        console.log('maskingdescriptor is ', maskingdescriptor)
        resolve(maskingdescriptor);
    })
}
