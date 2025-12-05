import math
import numpy as np

### THERMODYNAMIC CONSTANTS ###
r = 287
gamma = 1.40

### STATION VARIABLES ###
temperature_02 = 0
pressure_02  = 0
temperature_03 = 0
pressure_03 = 0
temperature_04 = 1700
pressure_04 = 0
temperature_05 = 0
pressure_05 = 0
temperature_08 = 0
pressure_08 = 0

### FUEL VARIABLES ###
fuel_to_air_ratio = 0
thrust_air_max_flux = 0
thrust_specific_fuel_consumption = 0

### EXIT VARIABLES ###
core_exit_exhaust_velocity = 0
fan_exit_exhaust_velocity = 0

### EFFICIENCIES ###
efficiency_thermal = 0
efficiency_propulsive = 0
efficiency_overall = 0

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

### TURBINE ###
def station_05(bypass_ratio, efficiency_turbine, gamma_turbine, c_p_compressor, c_p_turbine, c_p_fan, temperature_02, temperature_03, temperature_04, temperature_08, pressure_04, fuel_to_air_ratio):
    temperature_05 = temperature_04 + (1.0/(1.0+fuel_to_air_ratio))*((c_p_compressor/c_p_turbine)*(temperature_02-temperature_03) + bypass_ratio*(c_p_fan/c_p_turbine)*(temperature_02-temperature_08))
    pressure_05 = pressure_04*(1-(1.0/efficiency_turbine)*(1-(temperature_05/temperature_04)))**(gamma_turbine/(gamma_turbine-1.0))
    return temperature_05, pressure_05

### EXIT ###
def nozzle_exit(efficiency_nozzle, gamma_nozzle, efficiency_fan_nozzle, gamma_fan_nozzle, temperature_05, temperature_08, pressure_a, pressure_05, pressure_08):
    core_exit_exhaust_velocity = math.sqrt( 2*efficiency_nozzle*(gamma_nozzle/(gamma_nozzle-1.0))*r*temperature_05*(1.0-((pressure_a/pressure_05)**((gamma_nozzle-1.0)/gamma_nozzle))) )
    fan_exit_exhaust_velocity = math.sqrt( 2*efficiency_fan_nozzle*(gamma_fan_nozzle/(gamma_fan_nozzle-1.0))*r*temperature_08*(1.0-((pressure_a/pressure_08)**((gamma_fan_nozzle-1.0)/gamma_fan_nozzle))) )
    return core_exit_exhaust_velocity, fan_exit_exhaust_velocity

### THRUST ###
def thrust(bypass_ratio, fuel_to_air_ratio, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed):
    thrust_air_max_flux = ((1.0+fuel_to_air_ratio)*core_exit_exhaust_velocity) + (bypass_ratio*fan_exit_exhaust_velocity) - ((1.0+bypass_ratio)*flight_speed)
    thrust_specific_fuel_consumption = fuel_to_air_ratio / thrust_air_max_flux
    return thrust_air_max_flux, thrust_specific_fuel_consumption

### EFFICIENCIES ###
def efficiencies(fuel_heating_value, bypass_ratio, fuel_to_air_ratio, thrust_air_max_flux, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed):
    efficiency_thermal = ((0.5*(1.0+fuel_to_air_ratio)*(core_exit_exhaust_velocity)**2) + (0.5*bypass_ratio*fan_exit_exhaust_velocity**2) - (0.5*(1.0+bypass_ratio)*flight_speed**2))/(fuel_to_air_ratio*fuel_heating_value)
    efficiency_propulsive = (thrust_air_max_flux*flight_speed)/((0.5*(1.0+fuel_to_air_ratio)*(core_exit_exhaust_velocity)**2) + (0.5*bypass_ratio*fan_exit_exhaust_velocity**2) - (0.5*(1.0+bypass_ratio)*flight_speed**2))
    efficiency_overall = efficiency_thermal*efficiency_propulsive
    return efficiency_thermal, efficiency_propulsive, efficiency_overall

### GET AMBIENT PARAMETERS ###
def ambient(f_alt):
    h = f_alt*0.3048 # FT to M
    if h < 11000: # TROPOSPHERE
        tempa = 15.04 - 0.00649*h
        press = (101.29 * (((tempa+273.1)/288.08)**5.256))*1000.0
    elif h < 25000: # LOWER STRATOSPHERE
        tempa = -56.46
        press = (22.65 * math.exp(1.73-0.000157*h))*1000.0
    else: # SHOULD BE H < 25000
        tempa = -131.21 + 0.00299*h
        press = (2.488 * (((tempa+273.1)/216.6)**(-11.388)))*1000.0
    
    density = (press/1000.0) / (0.2869 * (tempa+273.1))
    tempa_k = tempa + 273.15
    
    return tempa_k, press, density

### MASS FLUX ###
def mass_flux(thrust_air_mass_flux, thrust_specific_fuel_consumption, thrust):
    air_mass_flux = (1.0/thrust_air_mass_flux) * thrust
    fuel_consumption_flux = thrust_specific_fuel_consumption * thrust
    return air_mass_flux, fuel_consumption_flux

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
    
    # beta_values = beta_values = np.arange(2, 10.5, 0.5) 
    # prc_values = np.arange(10,61, 1) 
    beta_values = beta_values = np.arange(2, 20.25, 0.25) 
    prc_values = np.arange(2,100.5, 0.5) 
    
    best_fuel = float("inf")
    best_beta = None
    best_prc = None
    
    X, Y = np.meshgrid(beta_values, prc_values)
    Z = np.zeros_like(X, dtype=float)
    for i, prc in enumerate(prc_values):
        for j, beta in enumerate(beta_values):
            *_, air_mass_flux, fuel_consumption_flux = evaluate_cycle(
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

            Z[i, j] = fuel_consumption_flux
            
            if fuel_consumption_flux > 0 and fuel_consumption_flux < best_fuel and beta < 12.5 and prc < 27:
                best_fuel = fuel_consumption_flux
                best_beta = beta
                best_prc = prc
    
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
    global temperature_04
    temperature_04 = turbine_max_temp
    
    ### AMBIENT ###
    temperature_a, pressure_a, density_a = ambient(flight_altitude)
    
    ### DIFFUSER ##
    temperature_02, pressure_02 = station_02(temperature_a, pressure_a, efficiency_diffuser, gamma_diffuser, flight_mach_number)
    ### FAN ###
    temperature_08, pressure_08 = station_08(fan_pressure_ratio, efficiency_fan, gamma_fan, temperature_02, pressure_02)
    ### COMPRESSOR ###
    temperature_03, pressure_03 = station_03(compressor_pressure_ratio, efficiency_compressor, gamma_compressor, temperature_02, pressure_02)
    ### BURNER ###
    temperature_04, pressure_04 = station_04(burner_pressure_ratio, temperature_04, pressure_03)
    ### TURBINE ###
    fuel_to_air_ratio = (temperature_04-temperature_03)/((fuel_heating_value/c_p_burner)-temperature_04)
    temperature_05, pressure_05 = station_05(bypass_ratio, efficiency_turbine, gamma_turbine, c_p_compressor, c_p_turbine, c_p_fan, temperature_02, temperature_03, temperature_04, temperature_08, pressure_04, fuel_to_air_ratio)
    ### EXIT ###
    try:
        core_exit_exhaust_velocity, fan_exit_exhaust_velocity = nozzle_exit(efficiency_nozzle, gamma_nozzle, efficiency_fan_nozzle, gamma_fan_nozzle, temperature_05, temperature_08, pressure_a, pressure_05, pressure_08)
    except Exception:
        core_exit_exhaust_velocity = 0
        fan_exit_exhaust_velocity = 0
        
    ## THRUST ###
    speed_of_sound = math.sqrt(gamma*r*temperature_a)
    flight_speed = flight_mach_number*speed_of_sound
    thrust_air_max_flux, thrust_specific_fuel_consumption = thrust(bypass_ratio, fuel_to_air_ratio, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed)
    ### EFFICIENCIES ###
    efficiency_thermal, efficiency_propulsive, efficiency_overall = efficiencies(fuel_heating_value, bypass_ratio, fuel_to_air_ratio, thrust_air_max_flux, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, flight_speed)
    
    air_mass_flux, fuel_consumption_flux = mass_flux(thrust_air_max_flux, thrust_specific_fuel_consumption, thrust_engine)
    
    return c_p_diffuser, c_p_fan, c_p_compressor, c_p_burner, \
        c_p_turbine, c_p_nozzle, c_p_fan_nozzle, \
        speed_of_sound, flight_speed, \
        temperature_a, pressure_a, \
        temperature_02, pressure_02, \
        temperature_03, pressure_03, \
        temperature_04, pressure_04, \
        temperature_05, pressure_05, \
        temperature_08, pressure_08, \
        fuel_to_air_ratio, core_exit_exhaust_velocity, fan_exit_exhaust_velocity, thrust_air_max_flux, thrust_specific_fuel_consumption, \
        efficiency_thermal, efficiency_propulsive, efficiency_overall, \
        air_mass_flux, fuel_consumption_flux
        
def update_values(ef_d, g_d, ef_f, g_f, ef_fn, g_fn, ef_c, g_c, ef_b, g_b, ef_t, g_t, ef_n, g_n, flg_alt, flg_ma, b_r, fpr, cpr, bpr, tmt, q, thr):
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
