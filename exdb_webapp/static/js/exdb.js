// js function used in the exdb webapp

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


ajaxReplaceContentPost = function(url, selector, data) {
    $.post(url, data, function(resp) {
        $(selector).empty().append(resp);
    });
};
              
function searchExercises() {
    tags = []
    langs = []
    $(".filterbutton[tag]:checked").each( function(index, elem) {
        tags.push($(elem).attr("tag"));
    });
    $(".filterbutton[lang]:checked").each( function(index, elem) {
        langs.push($(elem).attr("lang"));
    });
    description = $("#searchfield").val() || "";
    $.post(searchUrl,
           {tags: JSON.stringify(tags), langs: JSON.stringify(langs), description : description},
           function(resp) {
                $(".exerciselist").empty().append(resp);
           }
    );
};

function clearFilters() {
    $(".filterbutton").prop("checked", false).button("refresh");
    $("#searchfield").val("");
    searchExercises();
};
