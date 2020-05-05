var { InfectiousMatter, AgentStates, ContactGraph } = require('./simulation.js');
let InfectiousMatterSim = new InfectiousMatter('', true);
Matter = require('matter-js');

InfectiousMatterSim.setup_matter_env();


let res_prop = {
	type: "residence", 
	friction: 0.001,
	bounds: {
	    min: {
	        x: 0,
	        y: 0,
	    },
	    max: {
	        x: 1000,
	        y: 1000,
	    }
	}
 };

let res = InfectiousMatterSim.add_location('residence', res_prop);

for (let i=0; i<5000; i++) {
	InfectiousMatterSim.add_agent(res);
}


InfectiousMatterSim.add_event( {
    time: InfectiousMatterSim.simulation_params.sim_time_per_day * 1,
    callback: function() {
        //
        for (let i=0; i < 10; i++) {
            let random_agent = Matter.Common.choose(InfectiousMatterSim.agents);
            InfectiousMatterSim.expose_org(random_agent.body, AgentStates.S_INFECTED);
        }
    }
});


InfectiousMatterSim.run_headless(10);