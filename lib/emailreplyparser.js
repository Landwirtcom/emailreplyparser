// EmailReplyParser is a small library to parse plain text email content.  The
// goal is to identify which fragments are quoted, part of a signature, or
// original body content.  We want to support both top and bottom posters, so
// no simple "REPLY ABOVE HERE" content is used.
//
// Beyond RFC 5322 (which is handled by the [Ruby mail gem][mail]), there aren't
// any real standards for how emails are created.  This attempts to parse out
// common conventions for things like replies:
//
//     this is some text
//
//     On <date>, <author> wrote:
//     > blah blah
//     > blah blah
//
// ... and signatures:
//
//     this is some text
//
//     --
//     Bob
//     http://homepage.com/~bob
//
// Each of these are parsed into Fragment objects.
//
// EmailReplyParser also attempts to figure out which of these blocks should
// be hidden from users.
var EmailReplyParser = {
	VERSION: "0.2.8",

  	// Public: Splits an email body into a list of Fragments.
	//
	// text - A String email body.
	//
	// Returns an Email instance.
	read: function(text) {
		var email = new Email();
		return email.read(text);
	},

	// Public: Get the text of the visible portions of the given email body.
	//
	// text - A String email body.
	// [optional, default: false] include_signatures - Whether or not to include signatures in reply
	//
	// Returns a String.
	parse_reply: function (text, include_signatures) {
		if(typeof(include_signatures)==='undefined') include_signatures = false;
		return this.read(text).visible_text(include_signatures);
	}
};

String.prototype.trim = function() {
	return this.replace(/^\s*|\s*$/g, "");
};

String.prototype.ltrim = function() {
	return this.replace(/^\s*/g, "");
};

String.prototype.rtrim = function() {
	return this.replace(/\s*$/g, "");
};

String.prototype.reverse = function() {
    var s = "";
    var i = this.length;
    while (i>0) {
        s += this.substring(i-1,i);
        i--;
    }
    return s;
};

//http://3dmdesign.com/development/extending-javascript-strings-with-chomp-using-prototypes
String.prototype.chomp = function() {
	return this.replace(/(\n|\r)+$/, '');
};

// An Email instance represents a parsed body String.
var Email = function() {
	this.initialize();
};

Email.prototype = {
	fragments: [],

	initialize: function() {
		this.fragments = [];
		this.fragment = null;
	},

	// Public: Gets the combined text of the visible fragments of the email body.
	//
	// [Optional, default: false] include_signatures - whether or not signatures should be visible
	//
	// Returns a String.
	visible_text: function(include_signatures) {
		if(typeof(include_signatures)==='undefined') include_signatures = false;

		var visible_text = [];
		for (var key in this.fragments) {
			if (!this.fragments[key].hidden || (include_signatures && this.fragments[key].signature)) {
				visible_text.push(this.fragments[key].to_s());
			}
		}

		return visible_text.join("\n").rtrim();
	},

  // Splits the given text into a list of Fragments.  This is roughly done by
	// reversing the text and parsing from the bottom to the top.  This way we
	// can check for 'On <date>, <author> wrote:' lines above quoted blocks.
	//
	// text - A String email body.
	//
	// Returns this same Email instance.
	read: function(text) {
		// in 1.9 we want to operate on the raw bytes
		// text = text.dup.force_encoding('binary') if text.respond_to?(:force_encoding)

		// Normalize line endings.
		text = text.replace('\r\n', '\n');

		// Check for multi-line reply headers. Some clients break up
		// the "On DATE, NAME <EMAIL> wrote:" line into multiple lines.

		var quoteHeadersRegex = [
			/^\s*(On(?:(?!^>*\s*On\b|\bwrote:)[\s\S]){0,1000}wrote:)$/m, // On DATE, NAME <EMAIL> wrote:
			/^\s*(Le(?:(?!^>*\s*Le\b|\bécrit:)[\s\S]){0,1000}écrit :)$/m, // Le DATE, NAME <EMAIL> a écrit :
			/^\s*(El(?:(?!^>*\s*El\b|\bescribió:)[\s\S]){0,1000}escribió:)$/m, // El DATE, NAME <EMAIL> escribió:
			/^\s*(Il(?:(?!^>*\s*Il\b|\bscritto:)[\s\S]){0,1000}scritto:)$/m, // Il DATE, NAME <EMAIL> ha scritto:
			/^\s*(Em(?:(?!^>*\s*Em\b|\bescreveu:)[\s\S]){0,1000}escreveu:)$/m, // Em DATE, NAME <EMAIL>escreveu:
			/^\s*(Am\s.+\sum\s.+\sschrieb\s.+\s+?:)$/m, // Am DATE um TIME schrieb NAME:
			/^\s*(Am\s.+\s)schrieb.+\s?(\[|<).+(\]|>):$/m, // Am DATE schrieb NAME <EMAIL>:
			/^\s*(Am\s.+\s)schrieb.+\s?(\[|<).+\s+(\]|>):$/m, // Am DATE schrieb NAME <EMAIL>:

			/^\s*(Op\s[\s\S]+?schreef[\s\S]+:)$/m, // Il DATE, schreef NAME <EMAIL>:
			/^\s*((W\sdniu|Dnia)\s[\s\S]+?(pisze|napisał(\(a\))?):)$/mu, // W dniu DATE, NAME <EMAIL> pisze|napisał:
			/^\s*(Den\s.+\sskrev\s.+:)$/m, // Den DATE skrev NAME <EMAIL>:
			/^\s*(pe\s.+\s.+kirjoitti:)$/m, // pe DATE NAME <EMAIL> kirjoitti: 
			/^(在[\s\S]+写道：)$/m, // > 在 DATE, TIME, NAME 写道：
			/^(20[0-9]{2}\..+\s작성:)$/m, // DATE TIME NAME 작성:
			/^(20[0-9]{2}\/.+のメッセージ:)$/m, // DATE TIME、NAME のメッセージ:
			/^(.+\s<.+>\sschrieb:)$/m, // NAME <EMAIL> schrieb:
			/^(.+\son.*at.*wrote:)$/m, // NAME on DATE wrote:
			/^\s*(From\s?:.+\s?(\[|<).+(\]|>))/u, // "From: NAME <EMAIL>" OR "From : NAME <EMAIL>" OR "From : NAME<EMAIL>"(With support whitespace before start and before <)
			/\s*(De\s?:.+\s?(\[|<).+(\]|>))/u, // "De: NAME <EMAIL>" OR "De : NAME <EMAIL>" OR "De : NAME<EMAIL>"  (With support whitespace before start and before <)
			/^\s*(Van\s?:.+\s?(\[|<).+(\]|>))/u, // "Van: NAME <EMAIL>" OR "Van : NAME <EMAIL>" OR "Van : NAME<EMAIL>"  (With support whitespace before start and before <)
			/^\s*(Von\s?:.+\s?(\[|<).+(\]|>))/u, // "Von: NAME <EMAIL>" OR "Von : NAME <EMAIL>" OR "Von : NAME<EMAIL>"  (With support whitespace before start and before <)
			///^\s*(Gesendet\s?:.+\s?(\[|<).+(\]|>))/u, // "Gesendet: DATE" OR "Gesendet : DATE" OR "Gesendet : DATE"  (With support whitespace before start and before <)
			/^\s*(Da\s?:.+\s?(\[|<).+(\]|>))/u, // "Da: NAME <EMAIL>" OR "Da : NAME <EMAIL>" OR "Da : NAME<EMAIL>"  (With support whitespace before start and before <)
			/^(20[0-9]{2})-([0-9]{2}).([0-9]{2}).([0-9]{2}):([0-9]{2})*.(.*)?\n?(.*)>:$/m, // 20YY-MM-DD HH:II GMT+01:00 NAME <EMAIL>:
			/^\s*([a-z]{3,4}\.\s[\s\S]+\sskrev\s[\s\S]+:)$/m, // DATE skrev NAME <EMAIL>:
			/^([0-9]{2}).([0-9]{2}).(20[0-9]{2})(.*)(([0-9]{2}).([0-9]{2}))(.*)\"( *)<(.*)>( *):$/m, // DD.MM.20YY HH:II NAME <EMAIL>
		];

		quoteHeadersRegex.forEach((regex) => {
			let matches = text.match(regex);
			if (matches) {
			  text = text.replace(matches[0], matches[0].replace(/\s/g, " "));
			}
		});

		text = this.remove_headers(text);

		// The text is reversed initially due to the way we check for hidden
		// fragments.

		text = text.trim().reverse();

		// This determines if any 'visible' Fragment has been found.  Once any
		// visible Fragment is found, stop looking for hidden ones.
		this.found_visible = false;

		// This instance variable points to the current Fragment.  If the matched
		// line fits, it should be added to this Fragment.  Otherwise, finish it
		// and start a new Fragment.
		this.fragment = null;

		// Use the StringScanner to pull out each line of the email content.
		var lines = text.split('\n');

		for(var i in lines) {
			this.scan_line(lines[i]);
		}

		// Finish up the final fragment.  Finishing a fragment will detect any
		// attributes (hidden, signature, reply), and join each line into a
		// string.
		this.finish_fragment();

		// Now that parsing is done, reverse the order.
		this.fragments.reverse();

		return this;
	},

	// Line-by-Line Parsing

	// Scans the given line of text and figures out which fragment it belongs
	// to.
	//
	// line - A String line of text from the email.
	//
	// Returns nothing.
	scan_line: function(line) {
		var serviceOrDeviceRegex = [
			'Sent from my',
			'Envoyé de mon',
			'Enviado desde mi',
			'Sent from Yahoo Mail',
			'Get organized with Yahoo Mail',
			'- Original Message -',
			'Get Outlook for Android',
			'Sent from my Bell Samsung',
			'By replying or using an indeedemail.com email address',
			'Von meinem iPhone gesendet',
			'Diese Nachricht wurde von meinem Android Mobiltelefon mit GMX Mail gesendet.',
			'Von meinem Samsung Galaxy Smartphone gesendet.'
		];

		// todo : replace above string array with regex below
		var signatureRegex = [
			/^\s*--/,
			/^\s*__/,
			/^—/,
			/^—\w/,
			/^-\w/,
			/^-- $/,
			/^-- \s*.+$/,
			/^Sent from (?:\s*.+)$/,
			/^Gesendet von (?:\s*.+)$/,
			/^Envoyé depuis (?:\s*.+)$/,
			/^Enviado desde (?:\s*.+)$/,
			/^\+{30,}$/,
			/^Von meinem (?:\s*.+) gesendet$/
		];

		var regexString = '^(\\s*\u2014+\\s*$|\\s*-+\\s*$|_+\\s*$|\\w-$|\\w_$)|(^(\\w+\\s*){1,3} ';

		serviceOrDeviceRegex.forEach(function(s){
			regexString+= '-*\\s*' + s.reverse() + '\\s*-*|';
		})
		regexString = regexString.slice(0, -1) + '$)';

		var SIG_REGEX = new RegExp(regexString);
		var QUOTED_REGEX = new RegExp('(>+)$');

		line = line.chomp('\n');
		if (!SIG_REGEX.test(line)) {
			line = line.ltrim();
		}

		// Mark the current Fragment as a signature if the current line is '' or the end of a quoted fragment
		// and the Fragment starts with a common signature indicator.
		if (this.fragment !== null){
			if (SIG_REGEX.test(this.fragment.last_n_line(1)) || (SIG_REGEX.test(this.fragment.last_n_line(2)) && !QUOTED_REGEX.test(this.fragment.last_n_line(2)))) {
				this.fragment.signature = true;
				this.finish_fragment();
			}
		}

		// We're looking for leading `>`'s to see if this line is part of a
		// quoted Fragment.
		var is_quoted = (QUOTED_REGEX.test(line));

		// If the line matches the current fragment, add it.  Note that a common
		// reply header also counts as part of the quoted Fragment, even though
		// it doesn't start with `>`.
		if (this.fragment !== null && ((this.fragment.quoted === is_quoted) || (this.fragment.quoted && (this.quote_header(line.rtrim()) || line === '')))) {
			this.fragment.lines.push(line);

			// This fragment containes a quote header, but is not actually quoted. This occurs in
			// some clients that do not put > infront of the reply text. Mark this fragment as
			// quote manually. See email_iPhone2.txt for more info
			if (this.quote_header(line.rtrim()) && !this.fragment.quoted) {
				this.fragment.quoted = true;
				this.finish_fragment();
			}
		}

		// Otherwise, finish the fragment and start a new one.
		else {
			this.finish_fragment();
			this.fragment = new Fragment(is_quoted, line);
		}
	},

	// Detects if a given line is a header above a quoted area.  It is only
	// checked for lines preceding quoted regions.
	//
	// line - A String line of text from the email.
	//
	// Returns true if the line is a valid header, or false.
	quote_header: function(line) {
		return (new RegExp('(^:óibircse.*lE|^:tircé a.*eL|^:etorw.*nO$|^:\>.*\..*\@.*\<.*$)')).test(line);
	},

	remove_headers: function(text) {
		var pattern = /^[ ]*[From|Von|Gesendet]+:\s.*$/mi;
		if(pattern.test(text)) {
			var reply_header = (pattern.exec(text))[0];
			text = text.substring(0, text.indexOf(reply_header));
		}
		return text;
	},

	// Builds the fragment string and reverses it, after all lines have been
	// added.  It also checks to see if this Fragment is hidden.  The hidden
	// Fragment check reads from the bottom to the top.
	//
	// Any quoted Fragments or signature Fragments are marked hidden if they
	// are below any visible Fragments.  Visible Fragments are expected to
	// contain original content by the author.  If they are below a quoted
	// Fragment, then the Fragment should be visible to give context to the
	// reply.
	//
	//     some original text (visible)
	//
	//     > do you have any two's? (quoted, visible)
	//
	//     Go fish! (visible)
	//
	//     > --
	//     > Player 1 (quoted, hidden)
	//
	//     --
	//     Player 2 (signature, hidden)
	//
	finish_fragment: function() {
		if (this.fragment != null) {
			this.fragment.finish();

			if (!this.found_visible) {
				if (this.fragment.quoted || this.fragment.signature || this.fragment.to_s().trim() == '')
					this.fragment.hidden = true;
				else
			 		this.found_visible = true;
			}

			this.fragments.push(this.fragment);
			this.fragment = null;
		}
	}
};

// Fragments

// Represents a group of paragraphs in the email sharing common attributes.
// Paragraphs should get their own fragment if they are a quoted area or a
// signature.
var Fragment = function(quoted, first_line) {
	this.initialize(quoted, first_line);
};

Fragment.prototype = {
	// This is an Array of String lines of content.  Since the content is
	// reversed, this array is backwards, and contains reversed strings.
	attr_reader: [],

	// This is reserved for the joined String that is build when this Fragment
	// is finished.
	content: null,

	initialize: function(quoted, first_line) {
		this.signature = false;
		this.hidden = false;
		this.quoted = quoted;
		this.lines = [first_line];
		this.content = null;
		this.lines = this.lines.filter(function(){return true;});
	},

	// Builds the string content by joining the lines and reversing them.
	//
	// Returns nothing.
	finish: function() {
		this.content = this.lines.join("\n");
		this.lines = [];
		this.content = this.content.reverse();
	},

	to_s: function() {
		return this.content.toString();
	},

	last_n_line: function(n) {
		if (this.lines.length < n)
			return ""

		return this.lines[this.lines.length - n]
 	}
};

module.exports.EmailReplyParser = EmailReplyParser;
