var GLANCE_COBROWSE = {};

function getMaskList(agentlist) {
  // This block of code determines if there are agents of more than 1 role in the session.
  var roles = [];
  agentlist.forEach((agent, i) => {
    roles.push(agent.agentrole);
  });
  var uniqueRoles = new Set(roles);

  // If all of the agents in the session are from 1 role, unmask elements for that role
  if (uniqueRoles.size === 1) {
    return [
      `[data-agentrole]:not([data-agentrole='${agentlist[0].agentrole.toLowerCase()}'])`,
    ];
  } else {
    // Otherwise, mask everything with a data-agentrole attribute
    return ["[data-agentrole]"];
  }
}

// Hook function called by cobrowse script to get masking information
GLANCE_COBROWSE.getMaskingDescriptor = async function (params) {
  return new Promise(async (resolve, reject) => {
    let maskingdescriptor = {};

    try {
      console.log("params is ", params);

      if (params.agents && params.agents.count > 0) {
        maskingdescriptor.maskedelements = getMaskList(params.agents.agentlist);
      } else {
        // If agent information is not yet available, mask everything with a data-agentrole attribute
        maskingdescriptor.maskedelements = ["[data-agentrole]"];
      }
    } catch (e) {
      console.log("Masking descriptor error: ", e);
      console.log(
        `You are on version ${GLANCE.VERSION} of Glance.  5.2+ required.`
      );
      // Mask the entire page in the event of an error
      maskingdescriptor.maskpage = true;
    }
    console.log("maskingdescriptor is ", maskingdescriptor);
    resolve(maskingdescriptor);
  });
};
