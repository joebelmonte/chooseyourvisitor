var buttonClicked = function (e) {
  e.preventDefault();
  document.getElementById("submit-masked").classList.toggle("green");
};

var buttonClicked2 = function (e) {
  e.preventDefault();
  document.getElementById("submit-not-masked").classList.toggle("green");
};

var buttonClickedSe = function (e) {
  e.preventDefault();
  document.getElementById("submit-masked-se").classList.toggle("green");
};

var buttonClicked2Se = function (e) {
  e.preventDefault();
  document.getElementById("submit-not-masked-se").classList.toggle("green");
};

document
  .getElementById("submit-masked")
  .addEventListener("click", buttonClicked);
document
  .getElementById("submit-not-masked")
  .addEventListener("click", buttonClicked2);
document
  .getElementById("submit-masked-se")
  .addEventListener("click", buttonClickedSe);
document
  .getElementById("submit-not-masked-se")
  .addEventListener("click", buttonClicked2Se);
