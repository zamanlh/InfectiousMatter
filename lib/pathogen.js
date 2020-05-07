var uniqid = require("uniqid");
var { jStat } = require('jstat')


let _mutate_random_walk = function(other_agent) {
	let new_color = other_agent.color_float + jStat.normal.sample(0, 0.5);
	this.color_float = Math.min(Math.max(new_color, 0), 1);
}

function Pathogen(color) {
	this.interaction_callback = undefined;
	this.uuid = uniqid();	
	this.color_float = color || Math.random();
	this.mutation_function = _mutate_random_walk;
}

Pathogen.prototype.get_offspring = function(mut_rate) {
	let offspring_color = this.color_float;
	let new_pathogen = new Pathogen(offspring_color);

	if (Math.random() < mut_rate && this.mutation_function) {
		new_pathogen.mutation_function(this);
	}
	return new_pathogen;
};

module.exports = Pathogen;
