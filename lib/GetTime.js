var twoDigit = function(digit) {
	digit = parseInt(digit);

	return (digit < 10 ? "0" : "") + digit;
};

module.exports = function(tpl) {
	var date = new Date();
	var time = twoDigit(date.getHours()) + ":" + twoDigit(date.getMinutes()) + ":" + twoDigit(date.getSeconds());

	tpl = tpl || "[%t] ";

	return tpl.toString().replace(/\%t/g, time);
};
