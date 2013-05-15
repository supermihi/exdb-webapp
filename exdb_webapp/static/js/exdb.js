/** enables a jQuery UI tooltip for all elements having an "imgurl" attribute. The tooltip shows
 *  the appropriate image.
 */
enableImgTooltips = function() {
    $(document).tooltip({
        items: "[imgurl]",
        content: function() {
            var element = $(this);
            return '<img class="tooltipimage" src="' + element.attr("imgurl") + '"/>';
        }
    });
};


/** Perform an AJAX search of exercises for the given filters. Requires that an element
 *  #tagtree exists and is a dynatree instance; tag and category filters will be obtained
 *  from this tree.
 *  If an elements with class filterbutton and attribute lang exist and is in "checked" state,
 *  a language filter is added.
 *  The value of the element #searchfield is used as filter for the description (if nonempty).
 * 
 *  Resulting exercises are placed in the #exerciselist element.
 */
function searchExercises() {
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
    $.post(searchUrl,
           {
               tags: JSON.stringify(tags),
               categories: JSON.stringify(categories),
               langs: JSON.stringify(langs),
               description : description,
               sortcolumn : sortElem.attr("column"),
               sortdirection : sortElem.data("sort") || "desc"
           },
           function(resp) {
                $("#exerciselist").empty().append(resp["exercises"]);
                $("#exercisenumber").text(resp["number"]);
           }
    );
};

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
};


/** Create a dynatree on the #tagtree element that loads its contents via AJAX from
 *  tagTreeUrl.
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
};

/** Initialize buttons for constrolling the tag tree (add, remove, rename).
 */
function initTagTreeControls() {
    $("#addcategory").button().click(function(event) {
        $("#newcat_name").dialog("open");
    });
    $("#removecategory").button({disabled: true}).click(function(event) {
        node = $("#tagtree").dynatree("getActiveNode");
        if (node && !node.data.is_tag && !node.data.locked) {
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
    	$.post(tagUrl, { tree : jsonString },
    		   function(resp) {
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
	$("#removecategory").button("option", "disabled", node.data.is_tag || node.data.locked === true);
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


/** Return the last element of the list as returned by *split*.
 */ 
function extractLast(val) {
    return split(val).pop();
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
};
