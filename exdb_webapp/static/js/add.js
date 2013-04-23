editors = {}
$(function() {
    $( '.latexeditor' ).each(function(index, elem) {
        var lang = $(elem).parent().attr("lang");
        var textype = $(elem).parent().attr("textype");
        var editor = CodeMirror.fromTextArea($(elem)[0], {lineWrapping:true, lineNumbers:true});
        editors[textype+lang] = editor;
    });
    $(".texpreview").hide();
    $(".errorlog").hide();
    $("#tags") // don't navigate away from the field on tab when selecting an item
        .bind( "keydown", function( event ) {
        if ( event.keyCode === $.ui.keyCode.TAB &&
        $( this ).data( "ui-autocomplete" ).menu.active ) {
        event.preventDefault();
        }
        })
        .autocomplete({
        minLength: 0,
        source: function( request, response ) {
        // delegate back to autocomplete, but extract the last term
        response( $.ui.autocomplete.filter(
        availableTags, extractLast( request.term ) ) );
        },
        focus: function() {
        // prevent value inserted on focus
        return false;
        },
        select: function( event, ui ) {
        var terms = split( this.value );
        // remove the current input
        terms.pop();
        // add the selected item
        terms.push( ui.item.value );
        this.value = terms.join( ", " );
        return false;
        }
        });
    $('.textabs').each(function(index, elem) {
        $(elem).tabs({collapsible: true});
    });
    $( '.compilebutton' )
        .button()
        .click(function(event) {
            event.preventDefault();
            compileSnippet($(this));            
        });
    $("#addpreamble")
        .button()
        .click(function(event) {
            event.preventDefault();
            addPreambleLine();
        });
    $("#submitbutton")
        .button()
        .click(function(event) {
            event.preventDefault();
            if ( $.trim($("#description").val()) == "") {
                alert("Please enter a description");
                return;
            }
            var waiting = 4;
            var noTex = 0;
            var errors = false;
            $(".compilebutton").each(function(index, elem) {
                console.log("some button");
                var req = compileSnippet($(elem));
                if (req == 0) {
                    console.log("no tex here");
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
                    }
                });
                req.fail( function(req, status, err) {
                    alert("Server error");
                });
            });
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
    console.log(value);
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
    return $.ajax({
        type : 'POST',
        url  : rpclatexUrl,
        data : {tex : editor.getValue(),
                lang: lang,
                type: textype,
                preambles: JSON.stringify(preambles())
                },
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
    console.log("tex_solution = " + tex_solution);
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
    });
}

split = function( val ) {
    return val.split( /,\s*/ );
}
extractLast = function( term ) {
    return split( term ).pop();
}
