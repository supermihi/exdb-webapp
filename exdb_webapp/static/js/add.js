editors = {} // global dict holding the TeX editors; maps textype+lang to CodeMirror object

$(function() {
    // turn the textareas into latex editors
    $( '.latexeditor' ).each(function(index, elem) {
        var editor = CodeMirror.fromTextArea($(elem)[0], {lineWrapping:true, lineNumbers:true});
        parent = $(elem).parent();
        editors[parent.attr("textype")+parent.attr("lang")] = editor;
    });
    
    // hide inactive elements
    $(".texpreview").not("[src]").hide();
    $(".errorlog").hide();
    
    // autocompletion for the tags (stolen from jQueryUI examples)
    $("#tags").bind( "keydown", function( event ) {
            if ( event.keyCode === $.ui.keyCode.TAB &&
                $( this ).data( "ui-autocomplete" ).menu.active ) {
                event.preventDefault();
            }
        }).autocomplete({
            minLength: 0,
            source: function( request, response ) {
                response( $.ui.autocomplete.filter(
                    availableTags, extractLast( request.term ) ) );
            },
            focus: function() {
                return false;
            },
            select: function( event, ui ) {
                var terms = split( this.value );
                terms.pop();
                terms.push( ui.item.value );
                terms.push("")
                this.value = terms.join( ", " );
                return false;
            }
        });
        
    // make jQueryUI tabs for exercise/solution edit components
    $('.textabs').each(function(index, elem) {
        $(elem).tabs();
        });
    
    // make compile buttons that call compileSnippet()
    $( '.compilebutton' )
        .button()
        .click(function(event) {
            event.preventDefault();
            compileSnippet($(this));            
        });
    
    // activate addPreamble button
    $("#addpreamble")
        .button()
        .click(function(event) {
            event.preventDefault();
            addPreambleLine();
        });
    
    // activate submit button
    $("#submitbutton")
        .button()
        .click(function(event) {
            event.preventDefault();
            // check that a description has been entered
            if ( $.trim($("#description").val()) == "") {
                alert("Please enter a description");
                return;
            }
            
            // now "click" all compilebuttons and wait for the
            // responses; if it's okay then really call submit function
            
            var waiting = 4;
            var noTex = 0;
            var errors = false;
            $("#wait_submit").dialog("open");
            $(".compilebutton").each(function(index, elem) {
                var req = compileSnippet($(elem));
                if (req == 0) {
                    waiting -= 1;
                    noTex += 1;
                    if (noTex == 4)
                        alert("Please enter some tex code");
                    return;
                }
                req.done( function( resp ) {
                    if (errors)
                        return;
                    if (resp["status"] == "ok") {
                        waiting -= 1;
                        if (waiting == 0)
                            submit();
                    } else {
                        errors = true;
                        alert("please fix compilation errors first");
                        $("#wait_submit").dialog("close");
                    }
                });
                req.fail( function(req, status, err) {
                    alert("Server error");
                });
            });
        });
    $("#wait_submit").dialog({
        autoOpen:false,
        modal:true
        });
});

var addPreambleLine = function(text) {
    var li = $('<li><button class="preminus"></button><input type="text" id="preamble1" class="ui-widget-content ui-corner-all"/></li>');
    if (text)
        li.children("input").val(text);
    $("#preambles").append(li);
    li.children(".preminus")
        .button({icons: {primary: "ui-icon-minus"}, text: false})
        .click( function(event) {
            event.preventDefault();
            $(this).parent().remove();
        });
};

var preambles = function() {
    vals = [];
    $("#preambles input").each(function(index, elem) {
        val = $(elem).val();
        if ($.trim(val) != "")
            vals.push($.trim(val));
    });
    return vals;
};

var tags = function() {
    value = $("#tags").val().replace(/[\s,]+$/g, '');
    return split(value);
}

var compileSnippet = function(button) {
    var textype = button.parent().attr("textype");
    var lang = button.parent().attr("lang");
    var texpreview = button.siblings(".texpreview");
    var errorlog = button.siblings(".errorlog");
    var editor = editors[textype+lang];
    if ($.trim(editor.getValue()) == "")
        return 0;
    var progress = $('<div class="progressbar"></div>');
    var proglabel = $('<div class="progress-label">compiling, please be patient...</div>');
    progress.append(proglabel);
    progress.progressbar({value: false  });
    button.parent().prepend(progress);
    data = { tex : editor.getValue(), lang: lang, type:textype, preambles: JSON.stringify(preambles())};
    if (mode == "edit") {
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
                texpreview.hide();
                errorlog.find("pre").text(resp["log"]);
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
};

var submit = function() {
    var data = {};
    var tex_solution = {};
    var tex_exercise = {};
    $(".textab").each(function(index, elem) {
        var textype = $(elem).attr("textype");
        var lang = $(elem).attr("lang");
        var editor = editors[textype+lang];
        if ($.trim(editor.getValue()) == "")
            return;
        if (textype == "exercise")
            tex_exercise[lang] = $.trim(editor.getValue());
        else
            tex_solution[lang] = $.trim(editor.getValue());
    });
    data["tex_exercise"] = tex_exercise;
    data["tex_solution"] = tex_solution;
    data["tex_preamble"] = preambles();
    data["description"] = $("#description").val();
    data["tags"] = tags();
    $.ajax({
        type : 'POST',
        url : window.location.pathname,
        data: { data : JSON.stringify(data) },
        dataType : 'json',
        success : function(resp) {
            window.location = listUrl;
        },
        error : function(req, status, err) {
            console.log("nope submit bad");
        },
        async : false
    }).always(function() {$("#wait_submit").dialog("close");});
}

split = function( val ) {
    return val.split( /,\s*/ );
}
extractLast = function( term ) {
    return split( term ).pop();
}
