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
    $.post(searchUrl, {tags: JSON.stringify(tags), langs: JSON.stringify(langs)}, function(resp) {
        $(".exerciselist").empty().append(resp);
    });
};

function updateTagFilters() {
    $.get(tagfiltersUrl, function(resp) {
        $("#tagfilters").empty().append(resp);
        $(".filterbutton").button().click(function(event) {
            searchExercises();
        });
    });
};

function clearFilters() {
    $(".filterbutton").prop("checked", false).button("refresh");
    searchExercises();
};
