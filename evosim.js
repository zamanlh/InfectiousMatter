var UIkit = require('uikit');
var THREE = require('three');
let colormap = require('colormap')
let colors = colormap( {
    colormap: 'bone',
    nshades: 20,
    format: 'hex',
    alpha: 1
});

let pathogen_colors = colormap({
    colormap: 'blackbody',
    nshades: 15,
    format: 'hex',
    alpha: 1
})

let interpolate = require('color-interpolate');
let pathogen_color_range = interpolate(pathogen_colors);

//weird
let colorstr_to_vivacolor = function(colorstr) {
    return "0x" + new THREE.Color(colorstr).getHexString() + "ff";
}

let webgl_colors = colors.map(colorstr_to_vivacolor);

window.onload = function() {
    var Matter = require('matter-js');
    var Viva = require('vivagraphjs');
    var Plotly = require('plotly.js')

    var { InfectiousMatter, AgentStates, ContactGraph } = require('./lib/simulation.js');

    InfectiousMatter.prototype.migrate_event = function() {
        return () => {
            for (let i=0; i < world_params.num_visitors; i++) {
                let temp_agent = Matter.Common.choose(this.agents);
                if (temp_agent.migrating) continue;
                temp_agent.migrating = true;

                //let temp_dest = Matter.Common.choose(residences);
                let agent_home = temp_agent.home || temp_agent.location;

                let agent_residence_idx = residences.indexOf(temp_agent.home);
                let offset = Matter.Common.choose([-2, -1, 1 ,2]);
                let dest_idx = (agent_residence_idx + offset) % residences.length;
                if (dest_idx < 0) dest_idx = residences.length + dest_idx;

                let temp_dest = residences[dest_idx];

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

    let world_params = {
        num_residences: 1,
        residence_options: [],
        pop_size: 20,
        num_to_infect: 2,
        num_visitors: 1,
        residence_size: 300,
        residence_padding: 20

    };

    let simulation_params = {
        sim_time_per_day: 1000,
        agent_size: 3,
        link_lifetime: 200,
        pathogen_mut_prob: 0.1

    };
    simulation_params.link_lifetime = 7*simulation_params.sim_time_per_day;

    var infection_params = {
        per_contact_infection: 0.5, 

        incubation_period_mu: 5,
        incubation_period_sigma: 3,
        
        infectious_period_mu: 8,
        infectious_period_sigma: 2,
        fraction_asymptomatic: 0.0,
        
        asymptomatic_infectious_period_mu: 1.5,
        asymptomatic_infectious_period_sigma: 1.5,

        fraction_seek_care: 0.5,
        fraction_isolate: 0.2,
        time_to_seek_care: 2.5,
        movement_scale: 1,
    };

    /*
    let default_simulation_colors = {
        viva_colors: [0x9370DBff, 0x00FF00ff, 0xFFFF00ff, 0xFFA500ff, 0x0000FFff, 0xA9A9A9ff, 0xFF00FFff, 0x00CED1ff,0x98FB98ff, 0xCD853Fff],
        matter_colors: ["mediumpurple", "lime", "yellow", "orange", "blue", "darkgrey", "fuchsia", "darkturquoise", "palegreen", "peru"]
    } 
    */


    let default_simulation_colors = {
        viva_colors: webgl_colors,
        matter_colors: colors
    }

    let infection_layout = {
        margin: {
            l: 50,
            r: 10,
            b: 50,
            t: 10,
            pad: 10
          },
        showlegend: true,
        legend: {
            x:1,
            xanchor: 'right',
            y:1
        }, 
        xaxis: {
            title: "Days",
            rangemode: 'nonnegative'
        }, 
        yaxis: {
            title: "Count",
            rangemode: 'nonnegative'
        },
    };



    let InfectiousMatterSim = new InfectiousMatter('matterDiv', false, simulation_params, infection_params, default_simulation_colors);

    let viva_layout = Viva.Graph.Layout.forceDirected(ContactGraph, {
        springLength : 15,
        springCoeff : 0.00005,
        dragCoeff : 0.01,
        gravity : -1.5
    });

    let viva_graphics = Viva.Graph.View.webglGraphics();
    let viva_renderer = Viva.Graph.View.renderer(ContactGraph, {
        container: document.getElementById('graphDiv'),
        graphics: viva_graphics,
        renderLinks: true,
        layout: viva_layout

    });
    viva_renderer.run();
    for (let i=0; i < 50; i++) {
        viva_renderer.zoomOut();
    }
    
    var setup_world = function(res_size, res_pad) {
        residences = []
        let margin = res_pad || world_params.residence_padding || 20;
        let residence_size = res_size || world_params.residence_size || 140;

        let row = 0;
        let col = 0;

        for (let j=0; j < world_params.num_residences; j++) {
            
            if (margin + residence_size + (residence_size + margin)*row > 
                InfectiousMatterSim.matter_render.options.height) {
                
                row = 0;
                col += 1;
            }   

            let x_min = margin + (margin + residence_size) * col;
            let y_min = margin + (residence_size + margin) * row;

            let x_max = x_min + residence_size;
            let y_max = y_min + residence_size;
            
            let res_prop = {
                type: "residence", 
                friction: 0.002,
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
                //temp_agent.node
                if (typeof viva_graphics !== 'undefined') {
                    viva_graphics.getNodeUI(temp_agent.node.id).color = res.viva_node_color;
                    viva_graphics.getNodeUI(temp_agent.node.id).size = 20
                }
                
            }
        }

        InfectiousMatterSim.add_event({time: 1000, callback: InfectiousMatterSim.migrate_event(), recurring: true });
        InfectiousMatterSim.add_event( {
            time: InfectiousMatterSim.simulation_params.sim_time_per_day * 3,
            callback: function() {
                //
                for (let i=0; i < world_params.num_to_infect; i++) {
                    let random_agent = Matter.Common.choose(InfectiousMatterSim.agents);
                    InfectiousMatterSim.expose_org(random_agent.body, AgentStates.S_INFECTED);
                }
            }
        })

    };

    let clear_simulation = function() {
        //clearInterval(plotly_interval);
        //Plotly.purge('plotDiv');

        InfectiousMatterSim.clear_simulator();

        world_params.residence_options = [];

        ContactGraph.clear();

    };

    let reset_population = function() {
        InfectiousMatterSim.setup_matter_env();
        setup_world();

    };

    UIkit.util.on("#page7", 'inview', function(e) {
        document.getElementById('plotDiv').style.visibility = "visible";
        document.getElementById('graphDiv').style.visibility = "visible";

        let setup_rural_sim = function(num_visitors) {
            clear_simulation();
            world_params.pop_size = 1000; 
            world_params.num_residences = 20;
            world_params.residence_size = 80;
            world_params.residence_padding = 15;
            world_params.agent_size = 1.5;
            world_params.num_to_infect = 1;
            world_params.num_visitors = 5;

            /*world_params.residence_options = [
                {subpop_size: 80},
                {subpop_size: 150},
                {subpop_size: 150},
                {subpop_size: 100},
                {subpop_size: 120},
                {subpop_size: 100},
                {subpop_size: 180},
                {subpop_size: 120},
                {subpop_size: 100},
                {subpop_size: 100},
                {subpop_size: 100},
                {subpop_size: 100}
            ]*/

            reset_population();
            InfectiousMatterSim.infection_params.per_contact_infection = 0.5;
            InfectiousMatterSim.infection_params.movement_scale = 1.0;
            
        }

        setup_rural_sim(world_params.num_visitors);

    });

}
