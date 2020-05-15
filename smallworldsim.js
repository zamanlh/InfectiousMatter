var UIkit = require('uikit');
var THREE = require('three');
let colormap = require('colormap')
var Viva = require('vivagraphjs');
var PhyloGraph = new Viva.Graph.graph();
var Plotly = require('plotly.js');


let colors = colormap( {
    colormap: 'hsv',
    nshades: 20,
    format: 'hex',
    alpha: 1
});

let pathogen_colors = colormap({
    colormap: 'rainbow',
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

    var { InfectiousMatter, AgentStates, ContactGraph } = require('./lib/simulation.js');

    InfectiousMatter.prototype.local_migrate_event = function(num_to_migrate) {
        return () => {
            var num_visitors = num_to_migrate || world_params.num_local_visitors;

            for (let i=0; i < num_visitors; i++) {
                let temp_agent = Matter.Common.choose(this.agents);
                if (temp_agent.migrating) continue;
                temp_agent.migrating = true;

                //let temp_dest = Matter.Common.choose(residences);
                let agent_home = temp_agent.home || temp_agent.location;

                let agent_residence_idx = residences.indexOf(temp_agent.home);
                let offset = Matter.Common.choose([-1, 1]);
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

    InfectiousMatter.prototype.global_migrate_event = function(num_to_migrate) {

        return () => {
            var num_visitors = num_to_migrate || world_params.num_global_visitors;
            for (let i=0; i < num_visitors; i++) {
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


    let world_params = {
        num_residences: 20,
        residence_options: [],
        pop_size: 1000,
        num_to_infect: 0,
        num_global_visitors: 3,
        num_local_visitors: 10,
        residence_size: 70,
        residence_padding: 15,
        agent_size: 1.5

    };

    let simulation_params = {
        sim_time_per_day: 1000,
        agent_size: 3,
        link_lifetime: 200,
        pathogen_mut_prob: 0.0

    };
    simulation_params.link_lifetime = 7*simulation_params.sim_time_per_day;

    var infection_params = {
        per_contact_infection: 0.5, 
        movement_scale: 1.25,

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
    };

    let default_simulation_colors = {
        viva_colors: webgl_colors,
        matter_colors: colors
    }


    let InfectiousMatterSim = new InfectiousMatter('matterDiv', false, simulation_params, infection_params, default_simulation_colors);
    


    let phylo_viva_layout = Viva.Graph.Layout.forceDirected(PhyloGraph, {
        springLength : 12,
        springCoeff : 0.00005,
        dragCoeff : 0.01,
        gravity : -1.5
    });

    let phylo_viva_graphics = Viva.Graph.View.webglGraphics();

    let contact_viva_layout = Viva.Graph.Layout.forceDirected(ContactGraph, {
        springLength : 15,
        springCoeff : 0.00005,
        dragCoeff : 0.01,
        gravity : -1.5
    });

    let contact_viva_graphics = Viva.Graph.View.webglGraphics();
    let contact_viva_renderer = Viva.Graph.View.renderer(ContactGraph, {
        container: document.getElementById('graphDiv'),
        graphics: contact_viva_graphics,
        renderLinks: true,
        layout: contact_viva_layout,
        interactive: 'drag'

    });

    contact_viva_renderer.run();
    for (let i=0; i < 45; i++) {
        contact_viva_renderer.zoomOut();
    }



    let infection_layout = {
        margin: {
            l: 50,
            r: 10,
            b: 50,
            t: 10,
            pad: 10
          },
        showlegend: false,
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

    let plotly_interval = undefined;
    let get_fresh_traces = function() {
        let exposed = {
            x: [0],
            y: [0],
            type: 'scatter',
            mode: 'lines',
            stackgroup: 'one',
            name: "Exposed",
          marker: { color: "orange" }
        };

        let infected = {
          x: [0],
          y: [0],
          type: 'scatter',
          mode: 'lines',
          stackgroup: 'one',
          name: "Infected",
          marker: { color: "red" }
        };

        let recovered = {
          x: [0],
          y: [0],
          type: 'scatter',
          mode: 'lines',
          stackgroup: 'one',
          name: "Recovered",
          marker: { color: "green" }
        };

        let susceptible = {
            x: [0],
            y: [0],
            stackgroup: 'one',
            mode: 'lines',
            type: 'scatter',
            name: "Susceptible",
            marker: { color: "grey" }
        }

        let plot_data = [exposed, infected, recovered, susceptible];

        return plot_data;

    }
    /*
    Plotly.newPlot('plotDiv', plot_data, infection_layout);
        
    setInterval(function() {
        Plotly.extendTraces('plotDiv', {
            x: [
                [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day],
                [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day],
                [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day], 
                [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day]
                ],
            y: [
                [InfectiousMatterSim.state_counts[AgentStates.EXPOSED]],
                [InfectiousMatterSim.state_counts[AgentStates.S_INFECTED] + InfectiousMatterSim.state_counts[AgentStates.A_INFECTED]],
                [InfectiousMatterSim.state_counts[AgentStates.RECOVERED]],
                [InfectiousMatterSim.state_counts[AgentStates.SUSCEPTIBLE]]
                ]
        }, [0, 1, 2, 3]);
    }, 1000)
    */

    let infection_callback_phylo = function(infected_agent, other_agent) {
        if(other_agent) {
            //check if mutant or not...
            if(other_agent.pathogen.color_float == infected_agent.pathogen.color_float) {
                PhyloGraph.addLink(infected_agent.pathogen.uuid, other_agent.pathogen.genotype_parent_uuid);
                infected_agent.pathogen.genotype_parent_uuid = other_agent.pathogen.genotype_parent_uuid;
            } else {
                //we are a mutant, so we have a new genotype parent
                PhyloGraph.addLink(infected_agent.pathogen.uuid, other_agent.pathogen.uuid);

                infected_agent.pathogen.genotype_parent_uuid = other_agent.pathogen.uuid;
                //console.log(infected_agent.pathogen.genotype_parent_uuid);
            }
        } else {
            //no ogent infecting
            PhyloGraph.addNode(infected_agent.pathogen.uuid);
            PhyloGraph.addLink(infected_agent.pathogen.uuid, 'root');

            infected_agent.pathogen.genotype_parent_uuid = infected_agent.pathogen.uuid;
        }
        
        contact_viva_graphics.getNodeUI(infected_agent.uuid).color = colorstr_to_vivacolor(infected_agent.body.color);
        //phylo_viva_graphics.getNodeUI(infected_agent.pathogen.uuid).color = colorstr_to_vivacolor(infected_agent.body.color);
        //phylo_viva_graphics.getNodeUI(infected_agent.pathogen.uuid).size = 40;
    };

    InfectiousMatterSim.register_infection_callback(infection_callback_phylo);

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

                }  
            } else {
                world_params.residence_options.push({subpop_size: world_params.pop_size/world_params.num_residences});

            }
            
            for (let i=0; i<world_params.residence_options[residences.length-1].subpop_size; i++) {
                let temp_agent = InfectiousMatterSim.add_agent(res);
                //temp_agent.node
                if (typeof contact_viva_graphics !== 'undefined') {
                    contact_viva_graphics.getNodeUI(temp_agent.node.id).color = res.viva_node_color;
                    contact_viva_graphics.getNodeUI(temp_agent.node.id).size = 30
                }
                
            }
        }

        InfectiousMatterSim.add_event({time: 1000, callback: InfectiousMatterSim.local_migrate_event(), recurring: true });
        InfectiousMatterSim.add_event({time: 1000, callback: InfectiousMatterSim.global_migrate_event(), recurring: true });

        InfectiousMatterSim.add_event( {
            time: InfectiousMatterSim.simulation_params.sim_time_per_day * 2,
            callback: function() {
                //
                for (let i=0; i < world_params.num_to_infect; i++) {
                    let random_agent = Matter.Common.choose(InfectiousMatterSim.agents);
                    InfectiousMatterSim.expose_org(random_agent.body, AgentStates.S_INFECTED);
                }
            }
        });

    };



    //mouse interaction for infection...
    let add_mouse_infection = function() {
        Matter.Events.on(InfectiousMatterSim.mouseConstraint, 'mousedown', (event) => {
            if (InfectiousMatterSim.mouseConstraint.body && InfectiousMatterSim.mouseConstraint.body.agent_object) {
                InfectiousMatterSim.expose_org(InfectiousMatterSim.mouseConstraint.body, AgentStates.S_INFECTED);
            }
        });
    }



    let clear_simulation = function() {
        ContactGraph.clear();
        PhyloGraph.clear();
        PhyloGraph.addNode('root');
        Plotly.purge('plotDiv');

        clearInterval(plotly_interval);
        currentScale = 1;

        
        InfectiousMatterSim.clear_simulator();

        world_params.residence_options = [];
    };

    let reset_population = function() {
        InfectiousMatterSim.setup_matter_env();
        setup_world();
        //add_mouse_infection();

    };

    UIkit.util.on("#page1", 'inview', function(e) {
        document.getElementById('plotDiv').style.visibility = "hidden";
        document.getElementById('graphDiv').style.visibility = "hidden";

        world_params.num_to_infect = 0;
        world_params.num_local_visitors = 0;
        setup_evo_sim(0, 0);
    });

    UIkit.util.on("#page2", 'inview', function(e) {
        document.getElementById('plotDiv').style.visibility = "hidden";
        document.getElementById('graphDiv').style.visibility = "visible";

    });
    UIkit.util.on("#page3", 'inview', function(e) {
        document.getElementById('plotDiv').style.visibility = "hidden";
        document.getElementById('graphDiv').style.visibility = "visible";
        world_params.num_local_visitors = 10;
        world_params.num_global_visitors = 0;
        set_sliders(10, 0)

    });

    UIkit.util.on("#page4", 'inview', function(e) {
        document.getElementById('globalMigrationSlider_p5').disabled = false;
        document.getElementById('localMigrationSlider_p5').disabled = false;
        document.getElementById('restart_btn').disabled = false;
        document.getElementById('infect_btn').disabled = false;

        document.getElementById('graphDiv').style.visibility = "visible";
        world_params.num_local_visitors = 10;
        world_params.num_global_visitors = 0;
        set_sliders(10, 0)

    })

    UIkit.util.on("#page5", 'inview', function(e) {
        document.getElementById('globalMigrationSlider_p5').disabled = true;
        document.getElementById('localMigrationSlider_p5').disabled = true;
        document.getElementById('restart_btn').disabled = true;
        document.getElementById('infect_btn').disabled = true;


    })

    UIkit.util.on("#plot_marker", 'inview', function(e) {
        document.getElementById('plotDiv').style.visibility = "visible";
        document.getElementById('graphDiv').style.visibility = "visible";


    });
    

    UIkit.util.on("#localMigrationSlider", 'input', function(e) {
        let badge = document.getElementById('localMigrationBadge');
        badge.innerHTML = e.target.value;

        world_params.num_local_visitors = e.target.value;

    });

    UIkit.util.on("#globalMigrationSlider", 'input', function(e) {
        let badge = document.getElementById('globalMigrationBadge');
        badge.innerHTML = e.target.value;

        world_params.num_global_visitors = e.target.value;

    });

    UIkit.util.on("#localMigrationSlider_p5", 'input', function(e) {
        let badge = document.getElementById('localMigrationBadge_p5');
        badge.innerHTML = e.target.value;

        world_params.num_local_visitors = e.target.value;

    });

    UIkit.util.on("#globalMigrationSlider_p5", 'input', function(e) {
        let badge = document.getElementById('globalMigrationBadge_p5');
        badge.innerHTML = e.target.value;

        world_params.num_global_visitors = e.target.value;

    });

    let set_sliders = function(num_local, num_global) {

        document.getElementById('globalMigrationSlider').value = num_global;
        document.getElementById('globalMigrationBadge').innerHTML = num_global;

        document.getElementById('globalMigrationSlider_p5').value = num_global;
        document.getElementById('globalMigrationBadge_p5').innerHTML = num_global;
        

        document.getElementById('localMigrationSlider').value = num_local;
        document.getElementById('localMigrationBadge').innerHTML = num_local;

        document.getElementById('localMigrationSlider_p5').value = num_local;
        document.getElementById('localMigrationBadge_p5').innerHTML = num_local;

    };

    let setup_evo_sim = function(num_local_visitors, num_global_visitors) {
        world_params.num_local_visitors = num_local_visitors;
        world_params.num_global_visitors = num_global_visitors;

        set_sliders(num_local_visitors, num_global_visitors);
        clear_simulation();
        reset_population();

        Plotly.newPlot('plotDiv', get_fresh_traces(), infection_layout);

        plotly_interval = setInterval(function() {
            Plotly.extendTraces('plotDiv', {
                x: [
                    [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day],
                    [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day],
                    [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day], 
                    [InfectiousMatterSim.cur_sim_time/simulation_params.sim_time_per_day]
                    ],
                y: [
                    [InfectiousMatterSim.state_counts[AgentStates.EXPOSED]],
                    [InfectiousMatterSim.state_counts[AgentStates.S_INFECTED] + InfectiousMatterSim.state_counts[AgentStates.A_INFECTED]],
                    [InfectiousMatterSim.state_counts[AgentStates.RECOVERED]],
                    [InfectiousMatterSim.state_counts[AgentStates.SUSCEPTIBLE]]
                    ]
            }, [0, 1, 2, 3]);
        }, 2000)

    }

    setup_evo_sim(0,0);
    
    document.getElementById('9_1_btn').onclick = function() {
        world_params.num_to_infect = 1;
        setup_evo_sim(9, 1);
    }

    document.getElementById('8_2_btn').onclick = function() {
        world_params.num_to_infect = 1;
        setup_evo_sim(8, 2);
    }
    document.getElementById('local_10_btn').onclick = function() {
        world_params.num_to_infect = 1;
        setup_evo_sim(10, 0);
    }

    document.getElementById('global_10_btn').onclick = function() {
        world_params.num_to_infect = 1;
        setup_evo_sim(0, 10);
    }
    document.getElementById('restart_btn').onclick = function() {
        setup_evo_sim(world_params.num_local_visitors, world_params.num_global_visitors);
    }

    document.getElementById('infect_btn').onclick = function() {
        let random_agent = Matter.Common.choose(InfectiousMatterSim.agents);
        InfectiousMatterSim.expose_org(random_agent.body, AgentStates.S_INFECTED);

    }

}
