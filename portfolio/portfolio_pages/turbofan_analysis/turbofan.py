import math
import numpy as np

### THERMODYNAMIC CONSTANTS ###
r = 287.0


class CycleEvaluationError(ValueError):
    """Raised when an input set cannot produce a physical cycle state."""


def _require(condition, message):
    if not condition:
        raise CycleEvaluationError(message)


def _validate_finite_values(**values):
    for name, value in values.items():
        try:
            is_finite = math.isfinite(value)
        except TypeError as error:
            raise CycleEvaluationError(f"{name} must be a finite number.") from error
        _require(is_finite, f"{name} must be a finite number.")


def _validate_positive_values(**values):
    _validate_finite_values(**values)
    for name, value in values.items():
        _require(value > 0.0, f"{name} must be positive.")


def _validate_efficiencies(**efficiencies):
    _validate_finite_values(**efficiencies)
    for name, value in efficiencies.items():
        _require(0.0 < value <= 1.0, f"{name} must be greater than 0 and at most 1.")


def _validate_gammas(**gammas):
    _validate_finite_values(**gammas)
    for name, value in gammas.items():
        _require(value > 1.0, f"{name} must be greater than 1.")

### DIFFUSER ###
def station_02(temperature_a, pressure_a, efficiency_diffuser, gamma_diffuser, flight_mach_number):
    temperature_02 = temperature_a*(1.0 + (((gamma_diffuser - 1.0)/2.0)*(flight_mach_number)**2.0) )
    pressure_02 = pressure_a*((1.0 + (efficiency_diffuser*((temperature_02/temperature_a)-1.0)))**(gamma_diffuser/(gamma_diffuser-1.0)))
    return temperature_02, pressure_02

### FAN ###
def station_08(fan_pressure_ratio, efficiency_fan, gamma_fan, temperature_02, pressure_02):
    temperature_08 = temperature_02*(1.0 + (1.0/efficiency_fan)*((fan_pressure_ratio**((gamma_fan-1.0)/gamma_fan))-1.0))
    pressure_08 = pressure_02*fan_pressure_ratio
    return temperature_08, pressure_08

### COMPRESSOR ###
def station_03(compressor_pressure_ratio, efficiency_compressor, gamma_compressor, temperature_02, pressure_02):
    temperature_03 = temperature_02*(1.0 + (1.0/efficiency_compressor)*(((compressor_pressure_ratio)**((gamma_compressor-1.0)/gamma_compressor))-1.0))
    pressure_03 = pressure_02 * compressor_pressure_ratio
    return temperature_03, pressure_03

### BURNER ###
def station_04(burner_pressure_ratio, temperature_04, pressure_03):
    pressure_04 = pressure_03 * burner_pressure_ratio
    return temperature_04, pressure_04


def burner_fuel_ratio(temperature_03, temperature_04, c_p_compressor, c_p_burner, efficiency_burner, fuel_heating_value):
    """Solve the combustor enthalpy balance for fuel flow per core air flow."""
    _require(temperature_04 > temperature_03, "Turbine inlet temperature must exceed compressor exit temperature.")

    required_enthalpy_rise = c_p_burner*temperature_04-c_p_compressor*temperature_03
    available_fuel_energy = efficiency_burner*fuel_heating_value-c_p_burner*temperature_04
    _require(required_enthalpy_rise > 0.0, "The burner enthalpy rise must be positive.")
    _require(available_fuel_energy > 0.0, "Burner efficiency and fuel heating value cannot support the requested turbine inlet temperature.")

    fuel_to_air_ratio = required_enthalpy_rise/available_fuel_energy
    _require(math.isfinite(fuel_to_air_ratio) and fuel_to_air_ratio > 0.0, "Fuel-to-air ratio must be positive and finite.")
    return fuel_to_air_ratio

### TURBINE ###
def station_05(bypass_ratio, efficiency_turbine, gamma_turbine, c_p_compressor, c_p_turbine, c_p_fan, temperature_02, temperature_03, temperature_04, temperature_08, pressure_04, fuel_to_air_ratio):
    hot_mass_ratio = 1.0 + fuel_to_air_ratio
    _require(hot_mass_ratio > 0.0, "The turbine hot-stream mass ratio must be positive.")

    temperature_05 = temperature_04 + (1.0/hot_mass_ratio)*((c_p_compressor/c_p_turbine)*(temperature_02-temperature_03) + bypass_ratio*(c_p_fan/c_p_turbine)*(temperature_02-temperature_08))
    _require(math.isfinite(temperature_05) and temperature_05 > 0.0, "Turbine work demand produces a non-positive exit temperature.")
    _require(temperature_05 <= temperature_04, "Turbine exit temperature cannot exceed its inlet temperature in this model.")

    isentropic_temperature_ratio = 1.0-(1.0/efficiency_turbine)*(1.0-(temperature_05/temperature_04))
    _require(isentropic_temperature_ratio > 0.0, "Turbine work demand exceeds the available isentropic enthalpy drop.")

    pressure_05 = pressure_04*isentropic_temperature_ratio**(gamma_turbine/(gamma_turbine-1.0))
    _require(math.isfinite(pressure_05) and pressure_05 > 0.0, "Turbine exit pressure must be positive and finite.")
    return temperature_05, pressure_05

### EXIT ###
def _fully_expanded_nozzle_velocity(efficiency, gamma_nozzle, total_temperature, ambient_pressure, total_pressure, stream_name):
    """Return ideal nozzle velocity for a stream fully expanded to ambient pressure."""
    _validate_positive_values(
        **{
            f"{stream_name.lower()}_nozzle_total_temperature": total_temperature,
            f"{stream_name.lower()}_nozzle_total_pressure": total_pressure,
            "ambient_pressure": ambient_pressure,
        }
    )
    _require(total_pressure >= ambient_pressure, f"{stream_name} nozzle total pressure is below ambient pressure.")

    pressure_exponent = (gamma_nozzle-1.0)/gamma_nozzle
    expansion_term = 1.0-(ambient_pressure/total_pressure)**pressure_exponent
    _require(expansion_term >= -1e-12, f"{stream_name} nozzle expansion term is negative.")

    expansion_term = max(0.0, expansion_term)
    velocity_squared = 2.0*efficiency*(gamma_nozzle/(gamma_nozzle-1.0))*r*total_temperature*expansion_term
    _require(math.isfinite(velocity_squared) and velocity_squared >= 0.0, f"{stream_name} nozzle velocity is not real and finite.")
    return math.sqrt(velocity_squared)


def nozzle_exit(efficiency_nozzle, gamma_nozzle, efficiency_fan_nozzle, gamma_fan_nozzle, temperature_05, temperature_08, pressure_a, pressure_05, pressure_08):
    core_exit_exhaust_velocity = _fully_expanded_nozzle_velocity(
        efficiency_nozzle,
        gamma_nozzle,
        temperature_05,
        pressure_a,
        pressure_05,
        "Core",
    )
    fan_exit_exhaust_velocity = _fully_expanded_nozzle_velocity(
        efficiency_fan_nozzle,
        gamma_fan_nozzle,
        temperature_08,
        pressure_a,
        pressure_08,
        "Fan",
    )
    return core_exit_exhaust_velocity, fan_exit_exhaust_velocity

### THRUST ###
def thrust(bypass_ratio, fuel_to_air_ratio, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed):
    specific_thrust = ((1.0+fuel_to_air_ratio)*core_exit_exhaust_velocity) + (bypass_ratio*fan_exit_exhaust_velocity) - ((1.0+bypass_ratio)*flight_speed)
    _require(math.isfinite(specific_thrust) and specific_thrust > 0.0, "The cycle does not produce positive specific thrust.")
    thrust_specific_fuel_consumption = fuel_to_air_ratio/specific_thrust
    return specific_thrust, thrust_specific_fuel_consumption

### EFFICIENCIES ###
def efficiencies(fuel_heating_value, bypass_ratio, fuel_to_air_ratio, specific_thrust, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed):
    jet_power = (0.5*(1.0+fuel_to_air_ratio)*(core_exit_exhaust_velocity)**2) + (0.5*bypass_ratio*fan_exit_exhaust_velocity**2) - (0.5*(1.0+bypass_ratio)*flight_speed**2)
    fuel_power = fuel_to_air_ratio*fuel_heating_value
    _require(math.isfinite(jet_power) and jet_power > 0.0, "The cycle does not produce positive jet power.")
    _require(math.isfinite(fuel_power) and fuel_power > 0.0, "Fuel power must be positive and finite.")

    efficiency_thermal = jet_power/fuel_power
    efficiency_propulsive = (specific_thrust*flight_speed)/jet_power
    efficiency_overall = efficiency_thermal*efficiency_propulsive
    _validate_finite_values(
        thermal_efficiency=efficiency_thermal,
        propulsive_efficiency=efficiency_propulsive,
        overall_efficiency=efficiency_overall,
    )
    return efficiency_thermal, efficiency_propulsive, efficiency_overall

### GET AMBIENT PARAMETERS ###
def ambient(f_alt):
    _validate_finite_values(flight_altitude=f_alt)
    h = f_alt*0.3048 # FT to M
    if h < 11000: # TROPOSPHERE
        tempa = 15.04 - 0.00649*h
        press = (101.29 * (((tempa+273.1)/288.08)**5.256))*1000.0
    elif h < 25000: # LOWER STRATOSPHERE
        tempa = -56.46
        press = (22.65 * math.exp(1.73-0.000157*h))*1000.0
    else: # UPPER STRATOSPHERE
        tempa = -131.21 + 0.00299*h
        press = (2.488 * (((tempa+273.1)/216.6)**(-11.388)))*1000.0
    
    tempa_k = tempa + 273.15
    density = (press/1000.0) / (0.2869 * tempa_k)
    _validate_positive_values(ambient_temperature=tempa_k, ambient_pressure=press, ambient_density=density)
    
    return tempa_k, press, density

### MASS FLUX ###
def mass_flux(specific_thrust, thrust_specific_fuel_consumption, required_thrust):
    """Return core-air and fuel mass flow rates for the requested net thrust."""
    _require(required_thrust > 0.0, "Required thrust must be positive.")
    core_air_mass_flow = required_thrust/specific_thrust
    fuel_mass_flow = thrust_specific_fuel_consumption*required_thrust
    _validate_finite_values(core_air_mass_flow=core_air_mass_flow, fuel_mass_flow=fuel_mass_flow)
    return core_air_mass_flow, fuel_mass_flow

### OPTIMIZATION ###
def optimize(c_p_diffuser,
        c_p_fan,
        c_p_compressor,
        c_p_burner,
        c_p_turbine,
        c_p_nozzle,
        c_p_fan_nozzle,
        
        efficiency_diffuser,
        efficiency_fan,
        efficiency_compressor,
        efficiency_burner,
        efficiency_turbine,
        efficiency_nozzle,
        efficiency_fan_nozzle,
        
        gamma_diffuser,
        gamma_fan,
        gamma_compressor,
        gamma_burner,
        gamma_turbine,
        gamma_nozzle,
        gamma_fan_nozzle,
        
        flight_altitude,
        flight_mach_number,
        
        bypass_ratio,
        fan_pressure_ratio,
        compressor_pressure_ratio,
        burner_pressure_ratio,
        turbine_max_temp,
        fuel_heating_value,
        
        thrust):
    
    # The current bypass and compressor ratios are intentionally replaced by
    # this bounded grid. The returned point is the best sampled configuration,
    # not an unconstrained mathematical optimum.
    # prc_values = np.arange(10,61, 1) 
    beta_values = np.arange(2, 20.25, 0.25)
    prc_values = np.arange(2,100.5, 0.5) 
    
    best_fuel = float("inf")
    best_beta = None
    best_prc = None
    
    X, Y = np.meshgrid(beta_values, prc_values)
    Z = np.full_like(X, np.nan, dtype=float)
    for i, prc in enumerate(prc_values):
        for j, beta in enumerate(beta_values):
            try:
                *_, core_air_mass_flow, fuel_mass_flow = evaluate_cycle(
                    c_p_diffuser,
                    c_p_fan,
                    c_p_compressor,
                    c_p_burner,
                    c_p_turbine,
                    c_p_nozzle,
                    c_p_fan_nozzle,

                    efficiency_diffuser,
                    efficiency_fan,
                    efficiency_compressor,
                    efficiency_burner,
                    efficiency_turbine,
                    efficiency_nozzle,
                    efficiency_fan_nozzle,

                    gamma_diffuser,
                    gamma_fan,
                    gamma_compressor,
                    gamma_burner,
                    gamma_turbine,
                    gamma_nozzle,
                    gamma_fan_nozzle,

                    flight_altitude,
                    flight_mach_number,

                    beta,
                    fan_pressure_ratio,
                    prc,
                    burner_pressure_ratio,
                    turbine_max_temp,
                    fuel_heating_value,
                    thrust
                )
            except CycleEvaluationError:
                continue

            if not (math.isfinite(core_air_mass_flow) and core_air_mass_flow > 0.0):
                continue
            if not (math.isfinite(fuel_mass_flow) and fuel_mass_flow > 0.0):
                continue

            Z[i, j] = fuel_mass_flow
            
            if fuel_mass_flow < best_fuel:
                best_fuel = fuel_mass_flow
                best_beta = beta
                best_prc = prc

    if best_beta is None:
        best_fuel = math.nan

    return beta_values.tolist(), prc_values.tolist(), Z.tolist(), best_fuel, best_beta, best_prc

### EVALUATION ###
def evaluate_cycle(
    c_p_diffuser,
    c_p_fan,
    c_p_compressor,
    c_p_burner,
    c_p_turbine,
    c_p_nozzle,
    c_p_fan_nozzle,
    
    efficiency_diffuser,
    efficiency_fan,
    efficiency_compressor,
    efficiency_burner,
    efficiency_turbine,
    efficiency_nozzle,
    efficiency_fan_nozzle,
    
    gamma_diffuser,
    gamma_fan,
    gamma_compressor,
    gamma_burner,
    gamma_turbine,
    gamma_nozzle,
    gamma_fan_nozzle,
    
    flight_altitude,
    flight_mach_number,
    
    bypass_ratio,
    fan_pressure_ratio,
    compressor_pressure_ratio,
    burner_pressure_ratio,
    turbine_max_temp,
    fuel_heating_value,
    
    thrust_engine
):
    _validate_finite_values(
        c_p_diffuser=c_p_diffuser,
        c_p_fan=c_p_fan,
        c_p_compressor=c_p_compressor,
        c_p_burner=c_p_burner,
        c_p_turbine=c_p_turbine,
        c_p_nozzle=c_p_nozzle,
        c_p_fan_nozzle=c_p_fan_nozzle,
        flight_altitude=flight_altitude,
        flight_mach_number=flight_mach_number,
        bypass_ratio=bypass_ratio,
        fan_pressure_ratio=fan_pressure_ratio,
        compressor_pressure_ratio=compressor_pressure_ratio,
        burner_pressure_ratio=burner_pressure_ratio,
        turbine_max_temp=turbine_max_temp,
        fuel_heating_value=fuel_heating_value,
        thrust_engine=thrust_engine,
    )
    _validate_efficiencies(
        diffuser_efficiency=efficiency_diffuser,
        fan_efficiency=efficiency_fan,
        compressor_efficiency=efficiency_compressor,
        burner_efficiency=efficiency_burner,
        turbine_efficiency=efficiency_turbine,
        nozzle_efficiency=efficiency_nozzle,
        fan_nozzle_efficiency=efficiency_fan_nozzle,
    )
    _validate_gammas(
        diffuser_gamma=gamma_diffuser,
        fan_gamma=gamma_fan,
        compressor_gamma=gamma_compressor,
        burner_gamma=gamma_burner,
        turbine_gamma=gamma_turbine,
        nozzle_gamma=gamma_nozzle,
        fan_nozzle_gamma=gamma_fan_nozzle,
    )

    for name, value in {
        "diffuser specific heat": c_p_diffuser,
        "fan specific heat": c_p_fan,
        "compressor specific heat": c_p_compressor,
        "burner specific heat": c_p_burner,
        "turbine specific heat": c_p_turbine,
        "nozzle specific heat": c_p_nozzle,
        "fan nozzle specific heat": c_p_fan_nozzle,
    }.items():
        _require(value > 0.0, f"{name} must be positive.")

    _require(flight_mach_number >= 0.0, "Flight Mach number cannot be negative.")
    _require(bypass_ratio >= 0.0, "Bypass ratio cannot be negative.")
    _require(fan_pressure_ratio >= 1.0, "Fan pressure ratio must be at least 1.")
    _require(compressor_pressure_ratio >= 1.0, "Compressor pressure ratio must be at least 1.")
    _require(0.0 < burner_pressure_ratio <= 1.0, "Burner pressure ratio must be greater than 0 and at most 1.")
    _require(turbine_max_temp > 0.0, "Turbine inlet temperature must be positive.")
    _require(fuel_heating_value > 0.0, "Fuel heating value must be positive.")
    _require(thrust_engine > 0.0, "Required thrust must be positive.")

    temperature_04 = turbine_max_temp
    
    ### AMBIENT ###
    temperature_a, pressure_a, density_a = ambient(flight_altitude)
    
    ### DIFFUSER ##
    temperature_02, pressure_02 = station_02(temperature_a, pressure_a, efficiency_diffuser, gamma_diffuser, flight_mach_number)
    _validate_positive_values(temperature_02=temperature_02, pressure_02=pressure_02)
    ### FAN ###
    temperature_08, pressure_08 = station_08(fan_pressure_ratio, efficiency_fan, gamma_fan, temperature_02, pressure_02)
    _validate_positive_values(temperature_08=temperature_08, pressure_08=pressure_08)
    ### COMPRESSOR ###
    temperature_03, pressure_03 = station_03(compressor_pressure_ratio, efficiency_compressor, gamma_compressor, temperature_02, pressure_02)
    _validate_positive_values(temperature_03=temperature_03, pressure_03=pressure_03)
    ### BURNER ###
    temperature_04, pressure_04 = station_04(burner_pressure_ratio, temperature_04, pressure_03)
    _validate_positive_values(temperature_04=temperature_04, pressure_04=pressure_04)
    ### TURBINE ###
    fuel_to_air_ratio = burner_fuel_ratio(
        temperature_03,
        temperature_04,
        c_p_compressor,
        c_p_burner,
        efficiency_burner,
        fuel_heating_value,
    )
    temperature_05, pressure_05 = station_05(bypass_ratio, efficiency_turbine, gamma_turbine, c_p_compressor, c_p_turbine, c_p_fan, temperature_02, temperature_03, temperature_04, temperature_08, pressure_04, fuel_to_air_ratio)
    ### EXIT ###
    _require(pressure_05 > pressure_a, "Core nozzle total pressure must exceed ambient pressure.")
    if bypass_ratio > 0.0:
        _require(pressure_08 > pressure_a, "Fan nozzle total pressure must exceed ambient pressure when bypass flow is present.")
    core_exit_exhaust_velocity, fan_exit_exhaust_velocity = nozzle_exit(efficiency_nozzle, gamma_nozzle, efficiency_fan_nozzle, gamma_fan_nozzle, temperature_05, temperature_08, pressure_a, pressure_05, pressure_08)
        
    ## THRUST ###
    speed_of_sound = math.sqrt(gamma_diffuser*r*temperature_a)
    flight_speed = flight_mach_number*speed_of_sound
    specific_thrust, thrust_specific_fuel_consumption = thrust(bypass_ratio, fuel_to_air_ratio, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed)
    ### EFFICIENCIES ###
    efficiency_thermal, efficiency_propulsive, efficiency_overall = efficiencies(fuel_heating_value, bypass_ratio, fuel_to_air_ratio, specific_thrust, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed)
    
    core_air_mass_flow, fuel_mass_flow = mass_flux(specific_thrust, thrust_specific_fuel_consumption, thrust_engine)
    
    return c_p_diffuser, c_p_fan, c_p_compressor, c_p_burner, \
        c_p_turbine, c_p_nozzle, c_p_fan_nozzle, \
        speed_of_sound, flight_speed, \
        temperature_a, pressure_a, \
        temperature_02, pressure_02, \
        temperature_03, pressure_03, \
        temperature_04, pressure_04, \
        temperature_05, pressure_05, \
        temperature_08, pressure_08, \
        fuel_to_air_ratio, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, specific_thrust, thrust_specific_fuel_consumption, \
        efficiency_thermal, efficiency_propulsive, efficiency_overall, \
        core_air_mass_flow, fuel_mass_flow
        
def update_values(
    ef_d,
    g_d,
    ef_f,
    g_f,
    ef_fn,
    g_fn,
    ef_c,
    g_c,
    ef_b,
    g_b,
    ef_t,
    g_t,
    ef_n,
    g_n,
    flg_alt,
    flg_ma,
    b_r,
    fpr,
    cpr,
    bpr,
    tmt,
    q,
    thr,
):
    _validate_finite_values(
        diffuser_efficiency=ef_d,
        diffuser_gamma=g_d,
        fan_efficiency=ef_f,
        fan_gamma=g_f,
        fan_nozzle_efficiency=ef_fn,
        fan_nozzle_gamma=g_fn,
        compressor_efficiency=ef_c,
        compressor_gamma=g_c,
        burner_efficiency=ef_b,
        burner_gamma=g_b,
        turbine_efficiency=ef_t,
        turbine_gamma=g_t,
        nozzle_efficiency=ef_n,
        nozzle_gamma=g_n,
        flight_altitude=flg_alt,
        flight_mach_number=flg_ma,
        bypass_ratio=b_r,
        fan_pressure_ratio=fpr,
        compressor_pressure_ratio=cpr,
        burner_pressure_ratio=bpr,
        turbine_max_temp=tmt,
        fuel_heating_value=q,
        required_thrust=thr,
    )
    _validate_efficiencies(
        diffuser_efficiency=ef_d,
        fan_efficiency=ef_f,
        fan_nozzle_efficiency=ef_fn,
        compressor_efficiency=ef_c,
        burner_efficiency=ef_b,
        turbine_efficiency=ef_t,
        nozzle_efficiency=ef_n,
    )
    _validate_gammas(
        diffuser_gamma=g_d,
        fan_gamma=g_f,
        fan_nozzle_gamma=g_fn,
        compressor_gamma=g_c,
        burner_gamma=g_b,
        turbine_gamma=g_t,
        nozzle_gamma=g_n,
    )

    efficiency_diffuser = ef_d
    efficiency_fan = ef_f
    efficiency_compressor = ef_c
    efficiency_burner = ef_b
    efficiency_turbine = ef_t
    efficiency_nozzle = ef_n
    efficiency_fan_nozzle = ef_fn

    gamma_diffuser = g_d
    gamma_fan = g_f
    gamma_compressor = g_c
    gamma_burner = g_b
    gamma_turbine = g_t
    gamma_nozzle = g_n
    gamma_fan_nozzle = g_fn
    
    flight_altitude = flg_alt 
    flight_mach_number = flg_ma
    
    bypass_ratio = b_r
    fan_pressure_ratio = fpr
    compressor_pressure_ratio = cpr
    burner_pressure_ratio = bpr
    turbine_max_temp = tmt
    fuel_heating_value = q
    
    thrust = thr
    
    c_p_diffuser = (gamma_diffuser*r)/(gamma_diffuser-1.0)
    c_p_fan = (gamma_fan*r)/(gamma_fan-1.0)
    c_p_compressor = (gamma_compressor*r)/(gamma_compressor-1.0)
    c_p_burner = (gamma_burner*r)/(gamma_burner-1.0)
    c_p_turbine = (gamma_turbine*r)/(gamma_turbine-1.0)
    c_p_nozzle = (gamma_nozzle*r)/(gamma_nozzle-1.0)
    c_p_fan_nozzle = (gamma_fan_nozzle*r)/(gamma_fan_nozzle-1.0)
    
    results = evaluate_cycle(
        c_p_diffuser,
        c_p_fan,
        c_p_compressor,
        c_p_burner,
        c_p_turbine,
        c_p_nozzle,
        c_p_fan_nozzle,
        
        efficiency_diffuser,
        efficiency_fan,
        efficiency_compressor,
        efficiency_burner,
        efficiency_turbine,
        efficiency_nozzle,
        efficiency_fan_nozzle,
        
        gamma_diffuser,
        gamma_fan,
        gamma_compressor,
        gamma_burner,
        gamma_turbine,
        gamma_nozzle,
        gamma_fan_nozzle,
        
        flight_altitude,
        flight_mach_number,
        
        bypass_ratio,
        fan_pressure_ratio,
        compressor_pressure_ratio,
        burner_pressure_ratio,
        turbine_max_temp,
        fuel_heating_value,
        
        thrust
    )
    
    optimization = optimize(
        c_p_diffuser,
        c_p_fan,
        c_p_compressor,
        c_p_burner,
        c_p_turbine,
        c_p_nozzle,
        c_p_fan_nozzle,
        
        efficiency_diffuser,
        efficiency_fan,
        efficiency_compressor,
        efficiency_burner,
        efficiency_turbine,
        efficiency_nozzle,
        efficiency_fan_nozzle,
        
        gamma_diffuser,
        gamma_fan,
        gamma_compressor,
        gamma_burner,
        gamma_turbine,
        gamma_nozzle,
        gamma_fan_nozzle,
        
        flight_altitude,
        flight_mach_number,
        
        bypass_ratio,
        fan_pressure_ratio,
        compressor_pressure_ratio,
        burner_pressure_ratio,
        turbine_max_temp,
        fuel_heating_value,
        
        thrust
    )
    
    return results, optimization