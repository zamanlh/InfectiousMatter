var uniqid = require("uniqid");
var { jStat } = require('jstat')



let _mutate_random = function(other_agent) {
	let new_color = other_agent.color_float + jStat.exponential.sample(10);
	new_color = new_color % 1;
	//new_color = Math.random();

	this.color_float = new_color;
}

function Pathogen(color) {
	this.interaction_callback = undefined;
	this.uuid = uniqid();
	this.color_float = color || Math.random();
	this.mutation_function = _mutate_random;
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
