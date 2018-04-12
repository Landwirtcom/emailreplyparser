var fs = require('fs');

var _  = require('underscore');

var BreezyEmailReplyParser = require('../lib/emailreplyparser').BreezyEmailReplyParser;

function get_email(name) {
	var data = fs.readFileSync(__dirname + '/emails/' + name + '.txt', 'utf-8');
	return BreezyEmailReplyParser.read(data);
}

function get_raw_email(name) {
  return fs.readFileSync(__dirname + '/emails/' + name + '.txt', 'utf-8');
}

exports.test_reads_simple_body = function(test){
  var reply = get_email('email_1_1');
  test.equal(2, reply.fragments.length);

	test.deepEqual([false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
	test.deepEqual([false, true], _.map(reply.fragments, function(f) { return f.hidden; }));

  test.equal("Hi folks\n\nWhat is the best way to clear a Riak bucket of all key, values after\nrunning a test?\nI am currently using the Java HTTP API.\n\n-Abhishek Kona\n\n", reply.fragments[0].to_s());

	test.done();
};

exports.test_reads_top_post = function(test){
    reply = get_email('email_1_3');
    test.equal(4, reply.fragments.length);

    test.deepEqual([false, true, false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, true, true, true], _.map(reply.fragments, function(f) { return f.hidden; }));
    test.deepEqual([false, false, false, true], _.map(reply.fragments, function(f) { return f.signature; }));

    test.ok((new RegExp('^Oh thanks.\n\nHaving')).test(reply.fragments[0].to_s()));
    test.ok((/^On [^\:]+\:/m).test(reply.fragments[1].to_s()));
    test.ok((new RegExp('^_')).test(reply.fragments[3].to_s()));
    test.done();
};

exports.test_reads_bottom_post = function(test){
    var reply = get_email('email_1_2');
    test.equal(6, reply.fragments.length);

    test.deepEqual([false, true, false, true, false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, false, false, false, false, true], _.map(reply.fragments, function(f) { return f.signature; }));
    test.deepEqual([false, false, false, true, true, true], _.map(reply.fragments, function(f) { return f.hidden; }));

    test.equal("Hi,", reply.fragments[0].to_s());
    test.ok((new RegExp('^On [^\:]+\:')).test(reply.fragments[1].to_s()));
    test.ok((/^You can list/m).test(reply.fragments[2].to_s()));
    test.ok((/^> /m).test(reply.fragments[3].to_s()));
    test.ok((new RegExp('^_')).test(reply.fragments[5].to_s()));
    test.done();
};

exports.test_reads_inline_replies = function(test){
    var reply = get_email('email_1_8');
    test.equal(7, reply.fragments.length);

    test.deepEqual([true, false, true, false, true, false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, false, false, false, false, false, true], _.map(reply.fragments, function(f) { return f.signature; }));
    test.deepEqual([false, false, false, false, true, true, true], _.map(reply.fragments, function(f) { return f.hidden; }));

    test.ok((new RegExp('^On [^\:]+\:')).test(reply.fragments[0].to_s()));
    test.ok((/^I will reply/m).test(reply.fragments[1].to_s()));
    test.ok((/^> /m).test(reply.fragments[2].to_s()));
    test.ok((/^and under this./m).test(reply.fragments[3].to_s()));
    test.ok((/^> /m).test(reply.fragments[4].to_s()));
    test.equal('', reply.fragments[5].to_s().trim());
    test.ok((new RegExp('^-')).test(reply.fragments[6].to_s()));
    test.done();
};

exports.test_recognizes_date_string_above_quote = function(test){
    var reply = get_email('email_1_4');

    test.ok((/^Awesome/).test(reply.fragments[0].to_s()));
    test.ok((/^On/m).test(reply.fragments[1].to_s()));
    test.ok((/Loader/m).test(reply.fragments[1].to_s()));
    test.done();
};

exports.test_a_complex_body_with_only_one_fragment = function(test){
    var reply = get_email('email_1_5');

    test.equal(1, reply.fragments.length);
    test.done();
};

exports.test_reads_email_with_correct_signature = function(test){
    var reply = get_email('correct_sig');
    test.equal(2, reply.fragments.length);

    test.deepEqual([false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
		test.deepEqual([false, true], _.map(reply.fragments, function(f) { return f.signature; }));
		test.deepEqual([false, true], _.map(reply.fragments, function(f) { return f.hidden; }));

    test.ok((new RegExp('^--\\s*\\nrick')).test(reply.fragments[1].to_s()));
    test.done();
};

exports.test_deals_with_multiline_reply_headers = function(test){
    var reply = get_email('email_1_6');

    test.ok((new RegExp('^I get')).test(reply.fragments[0].to_s()));
    test.ok((/^On/m).test(reply.fragments[1].to_s()));
    test.ok((new RegExp('Was this')).test(reply.fragments[1].to_s()));
    test.done();
};

exports.test_does_not_modify_input_string = function(test){
    var original = "The Quick Brown Fox Jumps Over The Lazy Dog";
    BreezyEmailReplyParser.read(original);
    test.equal("The Quick Brown Fox Jumps Over The Lazy Dog", original);
    test.done();
};

exports.test_returns_only_the_visible_fragments_as_a_string = function(test){
		var reply = get_email('email_2_1');

		String.prototype.rtrim = function() {
			return this.replace(/\s*$/g, "");
		}

		var fragments = _.select(reply.fragments, function(f) { return !f.hidden; });
		var fragments = _.map(fragments, function(f) { return f.to_s(); });
		test.equal(fragments.join("\n").rtrim(), reply.visible_text());
  	test.done();
};

exports.test_parse_out_just_top_for_outlook_reply = function(test){
    var body = get_raw_email('email_2_1');
		test.equal("Outlook with a reply", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_sent_from_iPhone = function(test){
    var body = get_raw_email('email_iPhone');
    test.equal("Here is another email", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_sent_from_Yahoo_Mail = function(test){
    var body = get_raw_email('email_yahoo');
    test.equal("Here is another email", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_sent_from_BlackBerry = function(test){
    var body = get_raw_email('email_BlackBerry');
    test.equal("Here is another email", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_send_from_multiword_mobile_device = function(test){
    var body = get_raw_email('email_multi_word_sent_from_my_mobile_device');
    test.equal("Here is another email", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_do_not_parse_out_send_from_in_regular_sentence = function(test){
    var body = get_raw_email('email_sent_from_my_not_signature');
    test.equal("Here is another email\n\nSent from my desk, is much easier then my mobile phone.", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_retains_bullets = function(test){
    var body = get_raw_email('email_bullets');
    test.equal("test 2 this should list second\n\nand have spaces\n\nand retain this formatting\n\n\n   - how about bullets\n   - and another", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_reply = function(test){
    var body = get_raw_email('email_1_2');
    test.equal(BreezyEmailReplyParser.read(body).visible_text(), BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_accents_in_name = function(test){
		var body = get_raw_email('email_accents');
		test.equal("Lorem ipsum dolor sit amet, consectetur adipiscing elit.", BreezyEmailReplyParser.parse_reply(body));
		test.done();
};

exports.test_parse_out_sent_from_iPhone_french = function(test){
		var body = get_raw_email('email_iPhone_french');
		test.equal("Here is another email", BreezyEmailReplyParser.parse_reply(body));
		test.done();
};

exports.test_correctly_removes_signature_under_quoted_no_newline = function(test){
    var reply = get_email('email_1_9');
    test.equal(3, reply.fragments.length);

    test.deepEqual([false, true, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, true, true], _.map(reply.fragments, function(f) { return f.hidden; }));
    test.deepEqual([false, false, true], _.map(reply.fragments, function(f) { return f.signature; }));

    test.ok((new RegExp('^Dear recruiting team,\n\nThank you')).test(reply.fragments[0].to_s()));
    test.ok((/^On [^\:]+\:/m).test(reply.fragments[1].to_s()));
    test.ok((new RegExp('^--')).test(reply.fragments[2].to_s()));
    test.done();
};

exports.test_correctly_removes_original_message_text = function(test){
    var reply = get_email('email_1_10');
    test.equal(2, reply.fragments.length);

    test.deepEqual([false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, true], _.map(reply.fragments, function(f) { return f.hidden; }));
    test.deepEqual([false, true], _.map(reply.fragments, function(f) { return f.signature; }));

    test.ok((new RegExp('^I\'ll be at the hideout')).test(reply.fragments[0].to_s()));
    test.ok((new RegExp('^----- Original Message -----\n\n')).test(reply.fragments[1].to_s()));
    test.done();
};


exports.test_correctly_reads_top_post_when_line_starts_with_On = function(test){
    var reply = get_email('email_1_7');
    test.equal(4, reply.fragments.length);

    test.deepEqual([false, true, false, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, true, true, true], _.map(reply.fragments, function(f) { return f.hidden; }));
    test.deepEqual([false, false, false, true], _.map(reply.fragments, function(f) { return f.signature; }));

    test.ok((new RegExp('^Oh thanks.\n\nOn the')).test(reply.fragments[0].to_s()));
    test.ok((/^On [^\:]+\:/m).test(reply.fragments[1].to_s()));
    test.ok((new RegExp('^_')).test(reply.fragments[3].to_s()));
    test.done();
};

exports.test_parse_gmail = function(test){
		var body = get_email('email_from_gmail');
		test.equal("Let's do it!", body.fragments[0].to_s());
		test.done();
};

exports.test_parse_out_sent_from_iPhone2 = function(test){
    var body = get_raw_email('email_iPhone2');
    test.equal('Here is another email', BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_sent_from_iPhone3 = function(test){
		var body = get_raw_email('email_iPhone3');
		test.equal('Here is another email', BreezyEmailReplyParser.parse_reply(body));
		test.done();
};

exports.test_parse_out_send_from_french = function(test){
    var body = get_raw_email('email_french');
    test.equal("On a 60% de test sur toute l'Infra", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_send_from_spanish = function(test){
    var body = get_raw_email('email_spanish');
    test.equal("Muchas gracias.", BreezyEmailReplyParser.parse_reply(body));
    test.done();
};

exports.test_parse_out_send_from_hotmail = function(test){
    var body = get_raw_email('email_hotmail');
    test.equal("I replied", BreezyEmailReplyParser.parse_reply(body));
    test.done();
}

exports.test_parse_out_send_from_hotmail_2 = function(test){
    var body = get_raw_email('email_hotmail_2');
    test.equal("I replied", BreezyEmailReplyParser.parse_reply(body));
    test.done();
}

exports.test_email_with_emdash = function(test){
    var body = get_raw_email('email_em_dash');
    test.equal("Hey There,\n\nSounds Good!\n\nBest,\nMe", BreezyEmailReplyParser.parse_reply(body));
    test.done();
}

exports.test_email_with_reply_header_response = function(test){
    var reply = get_email('response_with_reply_header');
    test.equal(3, reply.fragments.length);

    test.deepEqual([false, true, false], _.map(reply.fragments, function(f) { return f.quoted; }));
    test.deepEqual([false, true, true], _.map(reply.fragments, function(f) { return f.hidden; }));
    test.deepEqual([false, false, false], _.map(reply.fragments, function(f) { return f.signature; }));

    test.ok((new RegExp('^11 would be best.*wrote:$')).test(reply.fragments[0].to_s()));
    test.done();
}

exports.test_spaces_before_reply_header = function(test){
    var body = get_raw_email('spaces_before_reply_header');
    test.equal("Ok just wanted to find out.", BreezyEmailReplyParser.parse_reply(body));
    test.done();
}

exports.test_indeed_email = function(test){
    var body = get_raw_email('email_indeed');
    test.equal("Hello. I have completed it. Thank you.", BreezyEmailReplyParser.parse_reply(body));
    test.done();
}
