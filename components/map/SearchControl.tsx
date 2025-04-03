import React, { useState, useRef } from 'react';
import AsyncSelect from 'react-select/async';
import { StylesConfig } from 'react-select';
import ReactCountryFlag from 'react-country-flag';
import countryList from 'react-select-country-list';

interface Country {
  value: string;  // ISO country code
  label: string;  // Country name
  lat: number;
  lng: number;
}

interface SearchControlProps {
  onSelectLocation: (location: { lat: number; lng: number; name: string }) => void;
  disabled?: boolean;
  placeholderText?: string;
}

interface OptionProps {
  innerProps: React.HTMLAttributes<HTMLDivElement>;
  data: Country;
  children: React.ReactNode;
}

interface SingleValueProps {
  data: Country;
  children: React.ReactNode;
}

// Enhanced country data with coordinates
const getCountriesWithCoordinates = (): Country[] => {
  const countries = countryList().getData();
  
  const countryCoordinates: Record<string, { lat: number; lng: number }> = {
    'US': { lat: 37.0902, lng: -95.7129 },
    'GB': { lat: 55.3781, lng: -3.4360 },
    'CA': { lat: 56.1304, lng: -106.3468 },
    'AU': { lat: -25.2744, lng: 133.7751 },
    'FR': { lat: 46.2276, lng: 2.2137 },
    'DE': { lat: 51.1657, lng: 10.4515 },
    'JP': { lat: 36.2048, lng: 138.2529 },
    'BR': { lat: -14.2350, lng: -51.9253 },
    'IN': { lat: 20.5937, lng: 78.9629 },
    'CN': { lat: 35.8617, lng: 104.1954 },
  };
  
  return countries.map(country => ({
    ...country,
    lat: countryCoordinates[country.value]?.lat || 0,
    lng: countryCoordinates[country.value]?.lng || 0
  }));
};

const CountrySearchControl: React.FC<SearchControlProps> = ({
  onSelectLocation,
  disabled = false,
  placeholderText = "Search for a country..."
}) => {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [inputValue, setInputValue] = useState('');
  const countries = useRef(getCountriesWithCoordinates());
  
  const customStyles: StylesConfig<Country, false> = {
    control: (provided) => ({
      ...provided,
      borderRadius: '4px',
      borderColor: '#d1d5db',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#9ca3af',
      },
      padding: '2px',
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#EBF5FF' : 'white',
      color: '#111827',
      padding: '10px 12px',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: '#F3F4F6',
      },
    }),
  };

  const filterCountries = (inputValue: string): Country[] => {
    return countries.current.filter(
      country => country.label.toLowerCase().includes(inputValue.toLowerCase())
    ).slice(0, 5);
  };
  
  const loadOptions = (
    inputValue: string,
    callback: (options: Country[]) => void
  ) => {
    setTimeout(() => {
      callback(filterCountries(inputValue));
    }, 300);
  };
  
  const handleChange = (selected: Country | null) => {
    if (selected) {
      setSelectedCountry(selected);
      onSelectLocation({
        lat: selected.lat,
        lng: selected.lng,
        name: selected.label
      });
    }
  };

  const CountryOption: React.FC<OptionProps> = ({ innerProps, data, children }) => (
    <div 
      {...innerProps}
      className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer"
    >
      <ReactCountryFlag 
        countryCode={data.value} 
        svg 
        style={{ marginRight: '8px', width: '24px', height: '16px' }}
      />
      <div>
        <div className="font-medium">{data.label}</div>
        <div className="text-xs text-gray-500">{data.value}</div>
      </div>
      {children}
    </div>
  );

  const SingleValue: React.FC<SingleValueProps> = ({ data }) => (
    <div className="flex items-center">
      <ReactCountryFlag 
        countryCode={data.value} 
        svg 
        style={{ marginRight: '8px', width: '22px', height: '14px' }}
      />
      <span>{data.label}</span>
    </div>
  );

  return (
    <div className="country-search-control">
      <AsyncSelect<Country>
        cacheOptions
        defaultOptions={countries.current.slice(0, 5)}
        loadOptions={loadOptions}
        onChange={handleChange}
        onInputChange={setInputValue}
        inputValue={inputValue}
        placeholder={placeholderText}
        isDisabled={disabled}
        styles={customStyles}
        components={{
          Option: CountryOption,
          SingleValue: SingleValue,
        }}
        noOptionsMessage={() => "No countries found"}
        className="country-select"
        classNamePrefix="country-select"
        isClearable
        value={selectedCountry}
      />
      
      {!selectedCountry && !inputValue && (
        <div className="mt-2 text-sm text-gray-500">
          <span className="font-medium">Popular:</span>{' '}
          <button 
            className="text-blue-600 hover:underline"
            onClick={() => handleChange(countries.current.find(c => c.value === 'US') || null)}
          >
            USA
          </button>{', '}
          <button 
            className="text-blue-600 hover:underline"
            onClick={() => handleChange(countries.current.find(c => c.value === 'GB') || null)}
          >
            UK
          </button>{', '}
          <button 
            className="text-blue-600 hover:underline"
            onClick={() => handleChange(countries.current.find(c => c.value === 'CA') || null)}
          >
            Canada
          </button>
        </div>
      )}
    </div>
  );
};

export default CountrySearchControl;