(function(){

var assetPreviews = document.querySelectorAll("#asset_container > div");
var previewExpanders = document.querySelectorAll("#asset_container > div > #expander");

var toggleExpand = function(dom){

	if(dom.getAttribute("expanded")==null){
		for(var i=0; i<assetPreviews.length; i++){
			var preview = assetPreviews[i];
			preview.removeAttribute("expanded");
		}
		dom.setAttribute("expanded","true");
	}else{
		dom.removeAttribute("expanded");
	}

};

for(var i=0; i<previewExpanders.length; i++){

	var preview = assetPreviews[i];
	var expander = previewExpanders[i];

	expander.onclick = (function(preview){
		return function(){
			toggleExpand(preview);
		};
	})(preview);

}

})();