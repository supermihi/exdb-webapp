function compileSnippet(textab) {
    var textype = textab.attr("textype");
    var lang = textab.attr("lang");
    var editor = editors[textype+lang];
    if ($.trim(editor.getValue()) == "")
        return 0;
    var texpreview = textab.find(".texpreview");
    var errorlog = textab.find(".errorlog");
    var progress = $('<div class="progressbar"></div>');
    var proglabel = $('<div class="progress-label">compiling, please be patient...</div>');
    progress.append(proglabel);
    progress.progressbar({value: false  });
    textab.prepend(progress);
    data = {
    		tex          : editor.getValue(),
    		lang         : lang,
    		type         : textype,
    		tex_preamble : JSON.stringify(preambles())
    		};
    if (mode === "edit") {
        data.creator = creator;
        data.number = number;
    }
    req = $.ajax({
        type : 'POST',
        url  : rpclatexUrl,
        data : data,
        dataType : 'json',
        success : function (resp) {
            if (resp['status'] == 'ok') {
                texpreview.attr('src', resp['imgsrc'] + "?timestamp=" + new Date().getTime());
                texpreview.show();
                errorlog.hide();
            } else {
                errorlog.find("pre").text(resp["log"]);
                texpreview.hide();
                errorlog.show();
            }
        },
        error : function (req, status, err ) {
            errorlog.find("pre").text("Server communication error");
            errorlog.show();
            texpreview.hide();
        }
    });
    req.always(function() {
        progress.remove();
    });
    return req;
}

function setPreviewUrl(type, lang, src) {
	var textab = $('.textab[textype="'+type+'"][lang="'+lang+'"]');
	textab.find(".texpreview").attr("src", src).show();
	textab.find(".errorlog").hide();
}

function setErrorLog(type, lang, log) {
	var textab = $('.textab[textype="'+type+'"][lang="'+lang+'"]');
	textab.find(".errorlog>pre").text(log);
	textab.find(".errorlog").show();
	textab.find(".texpreview").hide();
}

function submit() {
	$("#wait_submit").dialog("open");
    var data = {};
    var tex_solution = {};
    var tex_exercise = {};
    $(".textab").each(function(index, elem) {
        var textype = $(elem).attr("textype");
        var lang = $(elem).attr("lang");
        var editor = editors[textype+lang];
        if ($.trim(editor.getValue()) == "")
            return;
        if (textype === "exercise")
            tex_exercise[lang] = $.trim(editor.getValue());
        else
            tex_solution[lang] = $.trim(editor.getValue());
    });
    data["tex_exercise"] = tex_exercise;
    data["tex_solution"] = tex_solution;
    data["tex_preamble"] = preambles();
    data["description"] = $("#description").val();
    data["tags"] = tags("#tags");
    $.ajax({
        type : 'POST',
        url : window.location.pathname,
        data: { data : JSON.stringify(data) },
        dataType : 'json',
        success : function(resp) {
        	if (resp['status'] === 'ok')
        		window.location.replace(listUrl);
        	else {
        		if (resp['status'] == 'errormsg')
        			alert(resp['log']);
        		else {
        			console.log(resp);
        			for (var i=0; i < resp['okays'].length; ++i) {
        				var ok = resp['okays'][i];
        				setPreviewUrl(ok.type, ok.lang, ok['imgsrc']);
        			}
        			setErrorLog(resp['type'], resp['lang'], resp['log']);
        			alert("Error compiling " + resp['type'] + " " + resp['lang']);
        		}
        			
        	}
        },
        error : function(req, status, err) {
            alert("error submitting");
        },
        async : false
    }).always(function() {
    	$("#wait_submit").dialog("close");
    });
}
