import React from 'react';
import { SelectOption } from '../../types';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';

type InputType = 'text' | 'date' | 'number' | 'time' | 'textarea' | 'select' | 'password';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
  label: string;
  id: string;
  type: InputType;
  options?: SelectOption[]; // For select type
  error?: string;
  containerClassName?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  type,
  options,
  error,
  className = '',
  containerClassName = '',
  ...props
}) => {
  const baseInputClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-600";
  const errorInputClasses = error ? "border-red-500 dark:border-red-400 focus:ring-red-500 focus:border-red-500" : "";
  const finalClassName = `${baseInputClasses} ${errorInputClasses} ${className}`;

  return (
    <div className={`mb-4 ${containerClassName}`}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea id={id} className={finalClassName} rows={3} {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} />
      ) : type === 'select' ? (
        <div className="relative">
          <select id={id} className={`${finalClassName} appearance-none pr-8`} {...props as React.SelectHTMLAttributes<HTMLSelectElement>}>
            {props.placeholder && <option value="">{props.placeholder}</option>}
            {options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      ) : (
        <input type={type} id={id} className={finalClassName} {...props as React.InputHTMLAttributes<HTMLInputElement>} />
      )}
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default FormField;