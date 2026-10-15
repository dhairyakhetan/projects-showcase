// Runs when the form is submitted
function calculate(event) {
  event.preventDefault(); // stop the page reloading

  // 1. Get the values from the form
  var name = document.getElementById("name").value;
  var shower = Number(document.getElementById("shower").value);
  var flush = Number(document.getElementById("flush").value);
  var laundry = Number(document.getElementById("laundry").value);
  var tap = document.querySelector("input[name=tap]:checked").value;
  var dishes = document.getElementById("dishes").value;

  // 2. Calculate litres per day (rough averages)
  var total = shower * 9 + flush * 6 + 40;
  total = total + Math.round(laundry * 50 / 7);   // 50 litres per load, spread over 7 days
  if (tap == "yes") {
    total = total + 5;
  }
  if (dishes == "tap") {
    total = total + 15;
  } else {
    total = total + 5;
  }

  // 3. Choose a message and colour
  var message = "";
  var colour = "";
  if (total <= 100) {
    message = "Great job, " + name + "! 🌍";
    colour = "#c9f2d9";
  } else if (total <= 150) {
    message = "Not bad, " + name + ", you can save more. 🙂";
    colour = "#fff0b3";
  } else {
    message = "Oh no, " + name + "! That is a lot of water. 😟";
    colour = "#ffd0d0";
  }

  // 4. Make a tip for each bad habit
  var tips = [];
  if (shower > 5) {
    tips.push("Take a 5 minute shower.");
  }
  if (tap == "yes") {
    tips.push("Turn off the tap while brushing.");
  }
  if (dishes == "tap") {
    tips.push("Wash dishes in a bowl.");
  }
  if (tips.length == 0) {
    tips.push("You are doing everything right!");
  }

  // 5. Loop through the tips and make a list
  var list = "";
  for (var i = 0; i < tips.length; i++) {
    list = list + "<li>" + tips[i] + "</li>";
  }

  // 6. Show the answer
  var result = document.getElementById("result");
  result.style.background = colour;
  result.innerHTML = "<h1>" + total + " litres a day</h1><p>" + message + "</p><ul>" + list + "</ul>";
}
