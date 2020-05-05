var { InfectiousMatter, AgentStates, ContactGraph } = require('./lib/simulation.js');


let world_params = {
    num_residences: 5,
    residence_options: [],
    pop_size: 2000,
    num_to_infect: 2,
    num_visitors: 10,
    residence_size: 250,
    residence_padding: 20,
    world_height: 400

};

let simulation_params = {
    sim_time_per_day: 1000,
    agent_size: 3,
    link_lifetime: 200,
};
simulation_params.link_lifetime = 7*simulation_params.sim_time_per_day;

var infection_params = {
    per_contact_infection: 0.5, 

    incubation_period_mu: 5,
    incubation_period_sigma: 3,
    
    infectious_period_mu: 7,
    infectious_period_sigma: 4,
    fraction_asymptomatic: 0.2,
    
    asymptomatic_infectious_period_mu: 1.5,
    asymptomatic_infectious_period_sigma: 1.5,

    fraction_seek_care: 0.5,
    fraction_isolate: 0.2,
    time_to_seek_care: 2.5,
    movement_scale: 0.8,
};



let InfectiousMatterSim = new InfectiousMatter('matterDiv', true, simulation_params, infection_params);
Matter = require('matter-js');


world_params.num_residences = 9;
world_params.residence_size = 100;
world_params.residence_padding = 15;
world_params.agent_size = 1.5;
world_params.num_to_infect = 2;
world_params.num_visitors = 3;

world_params.residence_options = [
    {subpop_size: 400},
    {subpop_size: 100},
    {subpop_size: 10},
    {subpop_size: 50},
    {subpop_size: 12},
    {subpop_size: 10},
    {subpop_size: 50},
    {subpop_size: 12},
    {subpop_size: 10}
]

InfectiousMatterSim.infection_params.per_contact_infection = 0.5;
InfectiousMatterSim.infection_params.movement_scale = 1.0;

InfectiousMatterSim.setup_matter_env()

InfectiousMatter.prototype.migrate_event = function() {
    return () => {
        for (let i=0; i < world_params.num_visitors; i++) {
            let temp_agent = Matter.Common.choose(this.agents);
            if (temp_agent.migrating) continue;
            temp_agent.migrating = true;

            let temp_dest = Matter.Common.choose(residences);
            let agent_home = temp_agent.home || temp_agent.location;

            temp_agent.home_state = {position: temp_agent.body.position, velocity: temp_agent.body.velocity};

            temp_agent.location.migrate_to(temp_dest, temp_agent, function(agent) {
                    //update bounds...
                    agent.body.plugin.wrap = temp_dest.bounds;
                    Matter.Body.setPosition(agent.body, temp_dest.get_random_position());
                    agent.body.frictionAir = temp_dest.friction;
                }
            );
            
            this.add_event( {
                time: this.simulation_params.sim_time_per_day, 
                callback: function() {
                    temp_agent.location.migrate_to(agent_home, temp_agent, function(agent) {
                    //update bounds...
                        agent.body.plugin.wrap = agent_home.bounds;
                        Matter.Body.setPosition(agent.body, agent_home.get_random_position());
                        Matter.Body.setVelocity(agent.body, agent.home_state.velocity);
                        agent.body.frictionAir = agent_home.friction;
                        agent.migrating = false;
                    });
                }
            });

        }
    };
};

residences = []

let margin = world_params.residence_padding || 20;
let residence_size = world_params.residence_size || 140;

let row = 0;
let col = 0;

for (let j=0; j < world_params.num_residences; j++) {

	if (margin + residence_size + (residence_size + margin)*row > 
	    world_params.world_height) {
	    
	    row = 0;
	    col += 1;
	}   

	let x_min = margin + (margin + residence_size) * col;
	let y_min = margin + (residence_size + margin) * row;

	let x_max = x_min + residence_size;
	let y_max = y_min + residence_size;

	let res_prop = {
	    type: "residence", 
	    friction: 0.01,
	    bounds: {
	        min: {
	            x: x_min,
	            y: y_min,
	        },
	        max: {
	            x: x_max,
	            y: y_max,
	        }
	    }
	};
	row += 1;

	let res = InfectiousMatterSim.add_location('residence', res_prop);
	residences.push(res);

	if (world_params.residence_options[residences.length-1]) {
	    if (world_params.residence_options[residences.length-1].subpop_size == undefined) {
	        world_params.residence_options[residences.length-1].subpop_size = world_params.pop_size/world_params.num_residences;
	        //let new_subpop_gui = f4.add(world_params.residence_options[residences.length-1], "subpop_size", 0, 1000).step(1).name("Subpop " + this.residences.length);

	    }  
	} else {
	    world_params.residence_options.push({subpop_size: world_params.pop_size/world_params.num_residences});
	    //let new_subpop_gui = f4.add(world_params.residence_options[residences.length-1], "subpop_size", 0, 1000).step(1).name("Subpop " + this.residences.length);

	}

	for (let i=0; i<world_params.residence_options[residences.length-1].subpop_size; i++) {
	    let temp_agent = InfectiousMatterSim.add_agent(res);
	}
}
InfectiousMatterSim.add_event({time: simulation_params.sim_time_per_day * 1, callback: InfectiousMatterSim.migrate_event(), recurring: true });

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

InfectiousMatterSim.run_headless(50);