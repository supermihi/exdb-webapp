/** enables a jQuery UI tooltip for all elements having an "imgurl" attribute. The tooltip shows
 *  the appropriate image.
 */
function enableImgTooltips() {
    $(document).tooltip({
        items: "[imgurl]",
        content: function() {
            var element = $(this);
            return '<img class="tooltipimage" src="' + element.attr("imgurl") + '"/>';
        }
    });
}

var pageSize = 10; // how many exercises to display per page

/** Update the links to directly go to a specific page in the results list.
 * 
 *  Creates a link for each page (the current page will not be a link) in the #pagebuttons element.
 *  Each link has class pagebutton. On click the links call searchExercises(page) where page is the
 *  associated page number (starting with 0).
 */
function updatePageButtons(currentPage, totalNumber) {
	var numpages = Math.ceil(totalNumber/pageSize);
	$("#pagebuttons").empty();
	for(var i=0; i < numpages; ++i) {
		if (i*pageSize+1 === totalNumber)
			var rangeStr = i*pageSize+1;
		else
			var rangeStr = (i*pageSize+1) + "-" + Math.min(totalNumber, pageSize*(i+1));
		if (i == currentPage)
			$("#pagebuttons").append("<span class='pagebutton'>" + rangeStr +"</i>");
		else {
			var but = $("<a class='pagebutton' href='#'>" + rangeStr + '</a>');
			but.data("page", i).click( function(event) {
				event.preventDefault();
				searchExercises($(this).data("page"));
			});
			$("#pagebuttons").append(but);
		}
		$("#pagebuttons").append(" ");
	}
}

/** Perform an AJAX search of exercises for the given filters. Requires that an element
 *  #tagtree exists and is a dynatree instance; tag and category filters will be obtained
 *  from this tree.
 *  If an elements with class filterbutton and attribute lang exist and is in "checked" state,
 *  a language filter is added.
 *  The value of the element #searchfield is used as filter for the description (if nonempty).
 * 
 *  Resulting exercises are placed in the #exerciselist element.
 */
function searchExercises(page) {
    var langs = []
    var tags = []
    var categories = []
    $.each($("#tagtree").dynatree("getTree").getSelectedNodes(true), function(i, value) {
        if (value.data.is_tag)
            tags.push(value.data.title);
        else
            categories.push( [value.data.id, value.data.mat_path] );
        });
    $(".filterbutton[lang]:checked").each( function(index, elem) {
        langs.push($(elem).attr("lang"));
    });
    var description = $("#searchfield").val() || "";
    var sortElem = $("#sortbuttons>input:checked");
    var pagination = { orderby: sortElem.attr("column"), limit: pageSize}
    if (sortElem.data("sort") == "desc")
    	pagination["descending"] = true;
    if (!page)
    	page = 0;
    pagination["offset"] = pageSize*page;
    	
    $.post(searchUrl,
           {
               tags: JSON.stringify(tags),
               categories: JSON.stringify(categories),
               langs: JSON.stringify(langs),
               description : description,
               pagination: JSON.stringify(pagination),
           },
           function(resp) {
                $("#exerciselist").empty().append(resp["exercises"]);
                $("#exercisenumber").text(resp["number"]);
                updatePageButtons(page, resp["number"]);
           }
    );
}


/** Initializes the buttons for sorting exercise results by date, author, or description
 *  
 *  Makes #sortubttons a buttongroup, initializes the sorting by date / descending, and 
 *  installs click event handlers.
 */
function initSortButtons() {
	$("#sortbuttons").buttonset();
	setSorting($("#sortdate"), "desc");
	$("#sortbuttons>input").click(function(event) {
		switch ($(this).data("sort")) {
	        case "asc":
	            setSorting($(this), "desc");
	            break;
	        case "desc":
	            setSorting($(this), "asc");
	            break;
	        default:
	            setSorting($(this), $(this).attr("naturalsort"));
		}
		$(this).siblings("input").each(function(i, elem) {
			setSorting($(elem), null);
		});
		searchExercises();
	});
}


/** Update the sort button *elem* for the given sort direction.
 * 
 * *direction* should be either "asc", "desc", or Null. The method will update the button's icon
 * (triangle up- or downwards, or no icon for Null) and set its "sort" data to the given value.
 */
function setSorting(elem, direction) {
	switch(direction) {
		case "asc":
			elem.button("option", "icons", {secondary: "ui-icon-triangle-1-n"});
			break;
		case "desc":
			elem.button("option", "icons", {secondary: "ui-icon-triangle-1-s"});
			break;
		default:
			elem.button("option", "icons", {secondary: null});
	}
	elem.data("sort", direction);
}


/** Uncheck all .filterbutton elements, clear #searchfield, and uncheck everything
 *  in #tagtree. Then call searchEexercises() again.
 */
function clearFilters() {
    $(".filterbutton").prop("checked", false).button("refresh");
    $("#searchfield").val("");
    $("#tagtree").dynatree("getRoot").visit(function(node) {
        node.select(false);
    });
    searchExercises();
}

/** Remove the specified exercise.
 * 
 * First displays a dialog; if that is accepted, the exercise is removed in a synchronous AJAX call.
 */
function removeExercise(creator, number) {
	$("#dialog_message").text("Are you sure to remove exercise '" + creator + number + "'?");
	$("#confirm_dialog").one("dialogOk", function(event) {
		$(".exercise_listentry[creator='"+creator+"'][number='"+number+"']").remove();
		$("#wait_submit").dialog("open");
        $.post(
            removeUrl,
            { creator: creator, number: number },
            function(resp) {
               $("#tagtree").dynatree("getTree").reload(); // tags might have disappeared
               searchExercises();
            }
        ).always(function() {$("#wait_submit").dialog("close")});
	});
	$("#confirm_dialog").dialog("open");
}

/** Create a dynatree on the #tagtree element that loads its contents via AJAX from
 *  tagTreeUrl.
 *  
 *  If *dnd* is True then drag and drop will be enabled. 
 */
function makeTagTree(dnd) {
    options = {
        initAjax: { url : tagTreeUrl },
        selectMode: 3,
        checkbox: false,
        debugLevel: 0
    }
    if (dnd) {
        options['dnd'] = {
            onDragStart: function(node) {
                return !node.data.locked;
            },
            onDragEnter: function(node, sourceNode) {
                if (node.data.is_tag)
                    return ["before", "after"];
                if (node.data.mat_path == "." && sourceNode.data.is_tag)
                    return ["over"];
                if (node.data.locked && !sourceNode.data.is_tag)
                    return ["before"];
                return ["before", "over", "after"];
            },
            onDragOver: function(node, sourceNode, hitMode) {
                if (node.data.locked && hitMode=="over")
                    return false;
                if (hitMode !== "over") {
                    var parent = node.getParent();
                    if (parent.data.locked)
                        return false;
                }
                return true;
            },
            onDrop: function(node, sourceNode, hitMode, ui, draggable) {
                sourceNode.move(node, hitMode);
            }
        }
    }
    return $("#tagtree").dynatree(options);
}


/** Initialize buttons for constrolling the tag tree (add, remove, rename).
 */
function initTagTreeControls() {
    $("#addcategory").button().click(function(event) {
        $("#newcat_name").dialog("open");
    });
    $("#removetagorcat").button().click(function(event) {
        node = $("#tagtree").dynatree("getActiveNode");
        if (!node || node.data.locked)
        	return false;
        if (node.data.is_tag) {
        	$("#removetag_dialog").dialog("open");
        } else {
            var lockedNode;
            $.each($("#tagtree").dynatree("getRoot").getChildren(), function(index, node) {
                if (node.data.locked) {
                    lockedNode = node;
                    return false;
                }
            });
            var tagsToMove = [];
            node.visit(function(node) {
                if (node.data.is_tag)
                	tagsToMove.push(node);
            });
            $.each(tagsToMove, function(i, node) {
            	node.move(lockedNode);
            });
            node.remove();
        }
    });
    $("#renametag").button({disabled: true}).click(function(event) {
        var activeNode = $("#tagtree").dynatree("getActiveNode");
        if (!activeNode.data.locked) {
            $("#newname_input").val(activeNode.data.title);
            $("#renametag_newname").dialog("open");
        }
    });
    $("#savetagtree").button({icons: {primary: "ui-icon-check"}}).click(function(event) {
    	jsonString = JSON.stringify($("#tagtree").dynatree("getRoot").toDict(true).children);
    	$("#wait_submit").dialog("open");
    	$.post(tagUrl, { tree : jsonString },
            function(resp) {
    		    $("#wait_submit").dialog("close");
    			if (resp["status"] === "unchanged")
    			    alert("nothing changed");
    		    $("#tagtree").dynatree("getTree").reload();
    		   });
    });
    $("#canceltagtree").button({icons: {primary: "ui-icon-close"}}).click(function(event) {
    	$("#tagtree").dynatree("getTree").reload();
    });
}


/** Update tag tree controls when node is activated, i.e., (de)activate appropriate buttons.
 */
function updateTagTreeControls(node) {
	$("#removetagorcat").button("option", "disabled", node.data.locked === true);
	$("#renametag").button("option", "disabled", node.data.locked === true);
}


/** Read the value of the input specified by the given selector and split it into a
 *  list of tags (split by commas, remove whitespace).
 */
function tags(selector) {
    value = $(selector).val().replace(/[\s,]+$/g, '');
    return split(value);
}


/** Split a comma-separated string, ignoring any whitespaces around commas
 */
function split(val) {
    ret =  val.split( /,\s*/ );
    if (ret[0] == "")
        ret = [];
    return ret;
}


/** Return the last element of *val* after being split.
 */ 
function extractLast(val) {
    return split(val).pop();
}


/** 
 * Update the input field "#tags" with the given *tag*.
 * 
 * If *tag* is contained in the comma-separated list of values in "#tags", it is
 * removed, otherwise added at the end.
 */
function updateTagField(tag) {
	var currentTags = tags("#tags");
	var found = currentTags.indexOf(node.data.title);
	if (found == -1)
		currentTags.push(node.data.title);
	else
		currentTags.splice(found, 1);
	$("#tags").val(currentTags.join(", "));
}


/** Installs autocompletion on the #tags input field.
 * 
 * Uses the global variable "availableTags" as information source.
 */
function installTagAutocompletion() {
	// taken from jQueryUI examples
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
}


/** Initializes CodeMirror editors on all ".latexeditor" textareas
 * 
 * Stores the CodeMirror object in the global "editors" variable, and
 * and creates an appropriate resize function (vertical only).
 * 
 */
function createLatexEditors() {
	$( '.latexeditor' ).each(function(index, elem) {
        var editor = CodeMirror.fromTextArea(
        		$(elem)[0],
        		{
        			lineWrapping: true,
        			lineNumbers:  true
        		}
        );
        var parent = $(elem).parent();
        editors[parent.attr("textype")+parent.attr("lang")] = editor;
        
    });
    $('.CodeMirror').resizable({
    	resize: function() {
    		var parent = $(this).parent();
    		var editor = editors[parent.attr("textype")+parent.attr("lang")];
    	    editor.setSize($(this).width(), $(this).height());
    	},
    	minWidth: $(this).width(),
    	maxWidth: $(this).width(),
    });
}


/** Return a list of values of "#preambles input" elements. Input values
 *  that contain only whitespaces are ignored.
 */
function preambles() {
    vals = [];
    $("#preambles input").each(function(index, elem) {
        val = $(elem).val();
        if ($.trim(val) != "")
            vals.push($.trim(val));
    });
    return vals;
}


/** Add a new line to the preambles list.
 */
function addPreambleLine(text) {
    var li = $('<li>\
    		<button class="preminus"></button>\
    		<input type="text" class="ui-widget-content ui-corner-all"/>\
    		</li>');
    if (text)
        li.children("input").val(text);
    $("#preambles").append(li);
    li.children(".preminus")
        .button({icons: {primary: "ui-icon-minus"}, text: false})
        .click( function(event) {
            event.preventDefault();
            $(this).parent().remove();
        });
}


/** Inserts the values for the current exercise into the input fields of the "edit" page.
 *
 *  The values are taken from *exJson*, parsed JSON object returned by the view.
 */
function fillEditFields(exJson) {
	$("#addeditheading").text("Modify exercise " + exJson.creator + exJson.number);
	$("#description").val(exJson.description);
	$("#tags").val(exJson.tags.join(", "));
	$.each(exJson.tex_preamble, function(i, line) {
		addPreambleLine(line);
	});
	if (!exJson.tex_exercise.DE)
		$('.textabs[textype="exercise"]').tabs("option", "active", 1);
	if (!exJson.tex_solution.DE && exJson.tex_solution.EN)
		$('.textabs[textype="solution"]').tabs("option", "active", 1);
	$(".textab").each(function(i, elem) {
		var typ = $(elem).attr("textype");
		var lang = $(elem).attr("lang");
		if (exJson["tex_"+typ] && exJson["tex_"+typ][lang]) {
			editors[typ+lang].setValue(exJson["tex_"+typ][lang]);
			$(elem).find('.texpreview').attr("src", exJson["preview_"+typ+lang]);
		}
	});
}


/* Create and hide the wait_submit dialog */ 
$(function() {
	$("#wait_submit").dialog({
        autoOpen:false,
        modal:true
    });
	$("#confirm_dialog").dialog({
        autoOpen:false,
        modal:true,
        buttons: {
            Ok: function() {
            	$(this).dialog("close");
            	$(this).trigger("dialogOk");
            },
            Cancel: function() {
            	$(this).dialog("close");
            	$(this).trigger("dialogCancel");
            }
        }            
	});
});
