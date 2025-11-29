async function main(){
    let pyodide = await loadPyodide();
    const response = await fetch("turbofan.py");
    await pyodide.loadPackage("numpy");
    const pythonCode = await response.text();
    await pyodide.runPythonAsync(pythonCode);
    return pyodide;
}

let pyodideReadyPromise = main();

async function updateValues() {
    let pyodide = await pyodideReadyPromise;

    /* GET EFFICIENCY AND GAMMA INPUT VALUES */
    const efficiency_diffuser = parseFloat(
        document.getElementById("diffuser-efficiency").value
    );

    const gamma_diffuser = parseFloat(
        document.getElementById("diffuser-gamma").value
    );
    
    const efficiency_fan = parseFloat(
        document.getElementById("fan-efficiency").value
    );

    const gamma_fan = parseFloat(
        document.getElementById("fan-gamma").value
    );

    const efficiency_fan_nozzle = parseFloat(
        document.getElementById("fan-nozzle-efficiency").value
    );

    const gamma_fan_nozzle = parseFloat(
        document.getElementById("fan-nozzle-gamma").value
    );

    const efficiency_compressor = parseFloat(
        document.getElementById("compressor-efficiency").value
    );

    const gamma_compressor = parseFloat(
        document.getElementById("compressor-gamma").value
    );

    const efficiency_burner = parseFloat(
        document.getElementById("burner-efficiency").value
    );

    const gamma_burner = parseFloat(
        document.getElementById("burner-gamma").value
    );

    const efficiency_turbine = parseFloat(
        document.getElementById("turbine-efficiency").value
    );

    const gamma_turbine = parseFloat(
        document.getElementById("turbine-gamma").value
    );

    const efficiency_nozzle = parseFloat(
        document.getElementById("nozzle-efficiency").value
    );

    const gamma_nozzle = parseFloat(
        document.getElementById("nozzle-gamma").value
    );

    /* GET ENVIRONMENT INPUT VALUES */
    const flight_alt = parseFloat(
        document.getElementById("flight-altitude").value
    );

    const flight_mach = parseFloat(
        document.getElementById("flight-mach-number").value
    );

    /* GET ENGINE INPUT VALUES */
    const bypass_ratio = parseFloat(
        document.getElementById("bypass-ratio").value
    );

    const fan_pressure_ratio = parseFloat(
        document.getElementById("fan-pressure-ratio").value
    );

    const compressor_pressure_ratio = parseFloat(
        document.getElementById("compressor-pressure-ratio").value
    );

    const burner_pressure_ratio = parseFloat(
        document.getElementById("burner-pressure-ratio").value
    );

    const turbine_max_temp = parseFloat(
        document.getElementById("turbine-inlet-temperature").value
    );

    const fuel_heating_value = parseFloat(
        document.getElementById("fuel-heating-value").value
    );

    const thrust = parseFloat(
        document.getElementById("thrust").value
    );

    const python_result = pyodide.runPython(`update_values(${efficiency_diffuser}, ${gamma_diffuser}, ${efficiency_fan}, 
        ${gamma_fan}, ${efficiency_fan_nozzle}, ${gamma_fan_nozzle}, ${efficiency_compressor}, ${gamma_compressor},
        ${efficiency_burner}, ${gamma_burner}, ${efficiency_turbine}, ${gamma_turbine}, ${efficiency_nozzle},
        ${gamma_nozzle}, ${flight_alt}, ${flight_mach}, ${bypass_ratio},  ${fan_pressure_ratio},  ${compressor_pressure_ratio},
        ${burner_pressure_ratio}, ${turbine_max_temp}, ${fuel_heating_value}, ${thrust})`);

    const [values, optimization] = python_result.toJs();
    python_result.destroy();

    const [
        c_p_diffuser,
        c_p_fan,
        c_p_compressor,
        c_p_burner,
        c_p_turbine,
        c_p_nozzle,
        c_p_fan_nozzle,
        speed_of_sound,
        flight_speed,
        t_a,
        p_a,
        t_02,
        p_02,
        t_03,
        p_03,
        t_04,
        p_04,
        t_05,
        p_05,
        t_08,
        p_08,
        f_a_ratio,
        u_e,
        u_ef,
        t_a_m_f,
        t_s_f_c,
        ef_th,
        ef_pr,
        ef_oa,
        amf,
        fcf
    ] = values;

    document.getElementById("diffuser-specific-heat").value = c_p_diffuser.toFixed(3);
    document.getElementById("fan-specific-heat").value = c_p_fan.toFixed(3);
    document.getElementById("fan-nozzle-specific-heat").value = c_p_fan_nozzle.toFixed(3);
    document.getElementById("compressor-specific-heat").value = c_p_compressor.toFixed(3);
    document.getElementById("burner-specific-heat").value = c_p_burner.toFixed(3);
    document.getElementById("turbine-specific-heat").value = c_p_turbine.toFixed(3);
    document.getElementById("nozzle-specific-heat").value = c_p_nozzle.toFixed(3);

    document.getElementById("speed-of-sound").value = speed_of_sound.toFixed(1);
    document.getElementById("flight-speed").value = flight_speed.toFixed(1);

    document.getElementById("t-a").value = t_a.toFixed(1);
    document.getElementById("p-a").value = p_a.toFixed(1);

    document.getElementById("t-2").value = t_02.toFixed(1);
    document.getElementById("p-2").value = p_02.toFixed(1);

    document.getElementById("t-3").value = t_03.toFixed(1);
    document.getElementById("p-3").value = p_03.toFixed(1);

    document.getElementById("t-4").value = t_04.toFixed(1);
    document.getElementById("p-4").value = p_04.toFixed(1);

    document.getElementById("t-5").value = t_05.toFixed(1);
    document.getElementById("p-5").value = p_05.toFixed(1);

    document.getElementById("t-8").value = t_08.toFixed(1);
    document.getElementById("p-8").value = p_08.toFixed(1);

    document.getElementById("f-a-ratio").value = f_a_ratio.toFixed(5);
    document.getElementById("u-e").value = u_e.toFixed(2);
    document.getElementById("u-ef").value = u_ef.toFixed(2);
    document.getElementById("t-a-m-f").value = t_a_m_f.toFixed(2);
    document.getElementById("t-s-f-c").value = t_s_f_c.toFixed(5);

    document.getElementById("thermal-efficiency").value = ef_th.toFixed(3);
    document.getElementById("propulsive-efficiency").value = ef_pr.toFixed(3);
    document.getElementById("overall-efficiency").value = ef_oa.toFixed(3);

    document.getElementById("mass-flux").value = amf.toFixed(3);
    document.getElementById("fuel-consumption").value = fcf.toFixed(3);

    /* she optimize on my plot till i minimum */
    const [beta_values, prc_values, fuel_values, best_fuel, best_beta, best_prc,] = optimization;

    const data = {
        x: beta_values,     
        y: prc_values,    
        z: fuel_values,        
        type: "surface",
    };

    const optimum_point = {
        type: "scatter3d",
        mode: "markers",
        x: [best_beta],
        y: [best_prc],
        z: [best_fuel],
        marker: {
            size: 6,
            color: "red"
        },
        name: "Min. Fuel Consumption"
    }

    const surface_plot = [data, optimum_point]

    const layout = {
        title: { text: ""},
        paper_bgcolor: "rgba(0,0,0,0)", 
        plot_bgcolor: "rgba(0,0,0,0)",
        scene: {
            bgcolor: "rgba(0,0,0,0)",
            xaxis: { title: { text: "(x) β" } },
            yaxis: { title: { text: "(y) P_rc" } },
            zaxis: { title: { text: "(z) m_f [kg/s]" } }
        },
        margin: { l: 60, r: 20, t: 50, b: 60 }
    };

    layout.font = { size: 10 };

    Plotly.newPlot("optimization-plot", surface_plot, layout, { responsive: true });

    /*
    const rand = Math.random();
    const fart = new Audio("./fart.mp3")
    const taco = new Audio("./taco.mp3")
    const mince = new Audio("./minecraft.mp3")
    if (rand < 0.3333) {
        taco.play();
    } else if (rand < 0.6666) {
        fart.play();
    } else {
        mince.play();
    }
    */

    const fart = new Audio("./fart.mp3")
    fart.play();

}